// Load env files before config reads process.env.
import "./lib/env";
// Must be imported before `next` so globals such as AsyncLocalStorage exist when
// Next's App Router modules are evaluated. The Next CLI does this itself; a
// custom server started through tsx must do it explicitly.
import "next/dist/server/node-environment";
import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { config } from "./lib/config";
import { prisma } from "./lib/db";
import { verifySessionToken } from "./lib/auth/jwt";
import { bountyRoom, orderRoom, restaurantRoom, userRoom } from "./lib/realtime/events";
import { canAccessBountyRoom, canAccessOrderRoom } from "./lib/realtime/access";
import { setRealtimeServer } from "./lib/realtime/server";
import { runKitchenTick } from "./lib/services/kitchen-scheduler";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function parseCookies(header: string | undefined) {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

async function main() {
  await app.prepare();

  const httpServer = createServer((req, res) => handle(req, res));
  const io = new SocketServer(httpServer, {
    path: "/socket.io",
    serveClient: false,
    ...(process.env.SOCKET_CORS_ORIGIN
      ? { cors: { origin: process.env.SOCKET_CORS_ORIGIN, credentials: true } }
      : {}),
  });
  setRealtimeServer(io);

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const session = await verifySessionToken(cookies[config.auth.cookieName]);
      if (!session) return next(new Error("unauthorized"));
      const user = await prisma.user.findUnique({
        where: { id: session.sub },
        include: { memberships: { select: { restaurantId: true } } },
      });
      if (!user || user.role !== session.role) return next(new Error("unauthorized"));
      socket.data.userId = user.id;
      socket.data.role = user.role;
      socket.data.restaurantIds = user.memberships.map((m) => m.restaurantId);
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    const role = socket.data.role as "CUSTOMER" | "RESTAURANT";
    const restaurantIds = (socket.data.restaurantIds ?? []) as string[];

    socket.join(userRoom(userId));
    for (const id of restaurantIds) socket.join(restaurantRoom(id));

    socket.on("order:subscribe", async (orderId: unknown, ack?: (ok: boolean) => void) => {
      try {
        if (typeof orderId !== "string" || orderId.length > 64) return ack?.(false);
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { customerId: true, restaurantId: true },
        });
        if (!order) return ack?.(false);
        const allowed = canAccessOrderRoom({ role, userId, restaurantIds, order });
        if (!allowed) {
          socket.emit("socket:error", { message: "You cannot subscribe to this order." });
          return ack?.(false);
        }
        socket.join(orderRoom(orderId));
        return ack?.(true);
      } catch {
        return ack?.(false);
      }
    });

    socket.on("bounty:subscribe", async (bountyId: unknown, ack?: (ok: boolean) => void) => {
      try {
        if (typeof bountyId !== "string" || bountyId.length > 64) return ack?.(false);
        const bounty = await prisma.bounty.findUnique({
          where: { id: bountyId },
          select: {
            customerId: true,
            offers: { select: { restaurantId: true } },
            acceptedRestaurantId: true,
          },
        });
        if (!bounty) return ack?.(false);
        const allowed = canAccessBountyRoom({ role, userId, restaurantIds, bounty });
        if (!allowed) {
          socket.emit("socket:error", { message: "You cannot subscribe to this bounty." });
          return ack?.(false);
        }
        socket.join(bountyRoom(bountyId));
        return ack?.(true);
      } catch {
        return ack?.(false);
      }
    });

    socket.on("order:unsubscribe", (orderId: unknown) => {
      if (typeof orderId === "string") socket.leave(orderRoom(orderId));
    });
  });

  // Persistent just-in-time kitchen scheduler. In a serverless deployment,
  // call POST /api/kitchen/tick from a cron instead (see README).
  const tick = async () => {
    try {
      await runKitchenTick();
    } catch (error) {
      console.error("[kitchen scheduler]", error);
    }
  };
  setTimeout(tick, 4_000);
  const interval = setInterval(tick, config.kitchen.tickMs);

  httpServer.listen(port, hostname, () => {
    console.log(`\n  Rapid Dine ready → http://localhost:${port}`);
    console.log(`  Socket.IO + JIT kitchen scheduler attached (tick ${config.kitchen.tickMs}ms).\n`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    clearInterval(interval);
    io.close();
    httpServer.close(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Failed to start Rapid Dine server", error);
  process.exit(1);
});
