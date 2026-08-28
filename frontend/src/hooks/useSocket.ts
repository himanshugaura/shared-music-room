"use client";

import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

let _socket: Socket | null = null;

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
