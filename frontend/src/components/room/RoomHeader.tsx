"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { Room, QueueState, OnlineUser } from "@/types/room";
import { OnlineUsersModal } from "./OnlineUsersModal";

interface Props {
  room: Room;
  queue: QueueState | undefined;
  isOwner: boolean;
  onlineUsers?: OnlineUser[];
  currentUserId?: string;
}

export function RoomHeader({ room, queue, isOwner, onlineUsers = [], currentUserId }: Props) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(room.roomCode).then(() => {
      setCodeCopied(true);
      toast.success("Room code copied!");
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  return (
    <header
      className="room-header"
      style={{
        position: "relative",
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(13,17,23,0.95)",
        backdropFilter: "blur(12px)",
        flexWrap: "nowrap",
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      <Link
        href="/dashboard"
        className="room-header-back"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "#6b7a8d",
          textDecoration: "none",
          fontSize: 13,
          transition: "color 0.15s",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#d8dee9")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#6b7a8d")}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span className="room-header-back-label">Dashboard</span>
      </Link>

      <div className="room-header-divider" style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#eceff4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {room.name}
        </h1>
        {room.description && (
          <p style={{ margin: 0, fontSize: 11, color: "#6b7a8d", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {room.description}
          </p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => setUsersModalOpen(true)}
          title="View online listeners"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 8,
            border: "1px solid rgba(163,190,140,0.25)",
            background: "rgba(163,190,140,0.08)",
            color: "#eceff4",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(163,190,140,0.14)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(163,190,140,0.4)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(163,190,140,0.08)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(163,190,140,0.25)";
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#a3be8c",
              boxShadow: "0 0 6px #a3be8c",
              display: "inline-block",
            }}
          />
          <span style={{ color: "#a3be8c", fontWeight: 700 }}>
            {onlineUsers.length}
          </span>
          <span className="room-header-listeners-label" style={{ color: "#d8dee9", fontSize: 11 }}>
            {onlineUsers.length === 1 ? "online" : "online"}
          </span>
        </button>

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
            whiteSpace: "nowrap",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {codeCopied
              ? <polyline points="20 6 9 17 4 12" />
              : <><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1" /></>
            }
          </svg>
          {room.roomCode}
        </button>
      </div>

      <OnlineUsersModal
        open={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
        onlineUsers={onlineUsers}
        ownerId={room.ownerId}
        currentUserId={currentUserId}
      />

      <style>{`
        @media (max-width: 480px) {
          .room-header-back-label { display: none; }
          .room-header-divider { display: none; }
          .room-header-listeners-label { display: none; }
        }
      `}</style>
    </header>
  );
}
