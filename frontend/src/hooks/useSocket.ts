"use client";

/**
 * Singleton Socket.IO client.
 *
 * A single socket connection is shared across all hook call-sites so we never
 * accidentally open multiple connections to the server.
 */

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

let _socket: Socket | null = null;

/** Returns (lazily creating) the singleton socket. Must be called client-side. */
export async function getSocket(): Promise<Socket> {
  if (!_socket) {
    const { io } = await import("socket.io-client");
    _socket = io(process.env.NEXT_PUBLIC_BASE_URL!, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      autoConnect: false,
    });
  }
  return _socket;
}

/**
 * Hook that ensures the singleton socket is connected and returns a stable ref
 * to it.  The ref's `.current` is `null` during SSR and during the brief
 * window before the async import resolves.
 */
export function useSocket() {
  const ref = useRef<Socket | null>(null);

  useEffect(() => {
    let active = true;
    getSocket().then((socket) => {
      if (!active) return;
      ref.current = socket;
      if (!socket.connected) socket.connect();
    });
    return () => { active = false; };
  }, []);

  return ref;
}
