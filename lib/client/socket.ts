"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { RealtimePayloads, SocketEventName } from "@/lib/realtime/events";

let socket: Socket | null = null;

/** Lazily creates a single same-origin, cookie-authenticated Socket.IO client. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/socket.io",
      withCredentials: true,
      autoConnect: true,
      reconnectionDelay: 1200,
      reconnectionDelayMax: 8000,
    });
  }
  return socket;
}

export function useSocketEvent<K extends SocketEventName>(
  event: K,
  handler: (payload: RealtimePayloads[K]) => void,
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const client = getSocket();
    const listener = (payload: RealtimePayloads[K]) => handlerRef.current(payload);
    // Socket.IO's generic listener types cannot express our event map; the
    // server only emits the payloads declared in RealtimePayloads.
    client.on(event, listener as never);
    return () => {
      client.off(event, listener as never);
    };
  }, [event]);
}

/** Joins the private order or bounty room after the server verifies access. */
export function useRoomSubscription(kind: "order" | "bounty", id: string | null | undefined) {
  useEffect(() => {
    if (!id) return;
    const client = getSocket();
    const event = kind === "order" ? "order:subscribe" : "bounty:subscribe";
    const leaveEvent = kind === "order" ? "order:unsubscribe" : null;
    const join = () => client.emit(event, id, () => undefined);
    if (client.connected) join();
    client.on("connect", join);
    return () => {
      client.off("connect", join);
      if (leaveEvent) client.emit(leaveEvent, id);
    };
  }, [kind, id]);
}

export function useSocketStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const client = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    setConnected(client.connected);
    client.on("connect", onConnect);
    client.on("disconnect", onDisconnect);
    return () => {
      client.off("connect", onConnect);
      client.off("disconnect", onDisconnect);
    };
  }, []);

  return connected;
}
