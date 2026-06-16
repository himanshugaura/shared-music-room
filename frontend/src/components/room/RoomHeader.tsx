"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { Room, QueueState } from "@/types/room";

interface Props {
  room: Room;
  queue: QueueState | undefined;
  isOwner: boolean;
  onlineCount: number;
}

export function RoomHeader({ room, queue, isOwner, onlineCount }: Props) {
  const [codeCopied, setCodeCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(room.roomCode).then(() => {
      setCodeCopied(true);
      toast.success("Room code copied!");
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(13,17,23,0.95)",
        backdropFilter: "blur(12px)",
        flexWrap: "wrap",
        flexShrink: 0,
      }}
    >
      {/* Back */}
      <Link
        href="/dashboard"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "#6b7a8d",
          textDecoration: "none",
          fontSize: 13,
          transition: "color 0.15s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#d8dee9")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#6b7a8d")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Dashboard
      </Link>

      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

      {/* Room name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#eceff4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {room.name}
        </h1>
        {room.description && (
          <p style={{ margin: 0, fontSize: 11, color: "#6b7a8d", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {room.description}
          </p>
        )}
      </div>

      {/* Online count */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6b7a8d", flexShrink: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a3be8c", display: "inline-block", boxShadow: "0 0 6px rgba(163,190,140,0.6)" }} />
        {onlineCount} online
      </div>

      {/* Room code */}
      <button
        onClick={copyCode}
        title="Click to copy room code"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          color: codeCopied ? "#a3be8c" : "#d8dee9",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "monospace",
          cursor: "pointer",
          letterSpacing: "0.08em",
          transition: "all 0.15s",
          flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {codeCopied
            ? <polyline points="20 6 9 17 4 12" />
            : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>
          }
        </svg>
        {room.roomCode}
      </button>
    </header>
  );
}
