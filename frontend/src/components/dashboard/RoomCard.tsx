"use client";

import { useState } from "react";
import type { RoomSummary } from "@/types/room";
import { useDeleteRoom } from "@/hooks/useRooms";

function VisibilityBadge({ visibility }: { visibility: string }) {
  const isPublic = visibility === "public";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: isPublic ? "rgba(163,190,140,0.1)" : "rgba(143,188,187,0.1)",
        border: `1px solid ${isPublic ? "rgba(163,190,140,0.25)" : "rgba(143,188,187,0.25)"}`,
        color: isPublic ? "#a3be8c" : "#8fbcbb",
      }}
    >
      {isPublic ? (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ) : (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )}
      {visibility}
    </span>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface RoomCardProps {
  room: RoomSummary;
  isOwner?: boolean;
  onEnter?: (room: RoomSummary) => void;
}

export default function RoomCard({ room, isOwner = false, onEnter }: RoomCardProps) {
  const { mutate: deleteRoom, isPending: isDeleting } = useDeleteRoom();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteRoom(room.id, { onSettled: () => setConfirmDelete(false) });
  }

  return (
    <div
      style={{
        background: "rgba(22,27,34,0.65)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transition: "border-color 0.2s, box-shadow 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.13)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#eceff4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {room.name}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#6b7a8d" }}>
            {formatDate(room.createdAt)}
          </p>
        </div>
        <VisibilityBadge visibility={room.visibility} />
      </div>

      {/* Room code */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#6b7a8d" }}>Code</span>
        <code
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "#a3be8c",
            background: "rgba(163,190,140,0.08)",
            padding: "2px 8px",
            borderRadius: 6,
            border: "1px solid rgba(163,190,140,0.15)",
            userSelect: "all",
          }}
        >
          {room.roomCode}
        </code>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          id={`enter-room-${room.id}`}
          type="button"
          onClick={() => onEnter?.(room)}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
            color: "#0f1117",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.88")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Enter
        </button>

        {isOwner && (
          <button
            id={`delete-room-${room.id}`}
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: confirmDelete ? "1px solid rgba(191,97,106,0.5)" : "1px solid rgba(255,255,255,0.08)",
              background: confirmDelete ? "rgba(191,97,106,0.12)" : "rgba(255,255,255,0.04)",
              color: confirmDelete ? "#bf616a" : "#6b7a8d",
              fontSize: 12,
              fontWeight: 500,
              cursor: isDeleting ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseLeave={() => setConfirmDelete(false)}
          >
            {isDeleting ? "Deleting…" : confirmDelete ? "Confirm?" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}
