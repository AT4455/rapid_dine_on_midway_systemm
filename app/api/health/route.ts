import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return jsonOk({
      status: "ok",
      database: "connected",
      routingProvider: config.routing.provider,
      aiConfigured: config.ai.enabled,
      demoMode: config.demoMode,
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return jsonOk(
      {
        status: "degraded",
        database: "unreachable",
        hint: "Start MySQL and check DATABASE_URL.",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
