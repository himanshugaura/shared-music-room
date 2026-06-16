"use client";

import { useState } from "react";
import { QueueItem } from "./QueueItem";
import { AddSongModal } from "./AddSongModal";
import type { QueueState } from "@/types/room";

interface Props {
  roomId: string;
  queue: QueueState | undefined;
  currentUserId: string;
  isOwner: boolean;
}

export function QueuePanel({ roomId, queue, currentUserId, isOwner }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  const songs = queue?.songs ?? [];
  const filtered = songs.filter(song => song.id !== queue?.currentQueueSongId);
  const sorted = [...filtered].sort((a, b) => a.position - b.position);

  return (
    <aside
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "rgba(13,17,23,0.6)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#eceff4" }}>
            Queue
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a8d" }}>
            {filtered.length} {filtered.length === 1 ? "track" : "tracks"}
          </p>
        </div>

        <button
          onClick={() => setAddOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
            color: "#0f1117",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.85")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add song
        </button>
      </div>

      {/* Song list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
        {sorted.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 12,
              color: "#6b7a8d",
              textAlign: "center",
              padding: "40px 20px",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Queue is empty</p>
              <p style={{ margin: "4px 0 0", fontSize: 12 }}>Add a song to get started</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {sorted.map((song) => (
              <QueueItem
                key={song.id}
                song={song}
                isCurrent={song.id === queue?.currentQueueSongId}
                roomId={roomId}
                currentUserId={currentUserId}
                isOwner={isOwner}
              />
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <AddSongModal roomId={roomId} open={addOpen} onClose={() => setAddOpen(false)} />
      )}
    </aside>
  );
}
