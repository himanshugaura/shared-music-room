"use client";

import React, { useState } from "react";
import { useRemoveTrack, useVoteTrack } from "@/hooks/useRoom";
import type { QueueSong } from "@/types/room";

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  song: QueueSong;
  isCurrent: boolean;
  roomId: string;
  currentUserId: string;
  isOwner: boolean;
}

export const QueueItem = React.memo(function QueueItem({ song, isCurrent, roomId, currentUserId, isOwner }: Props) {
  const { mutate: removeTrack, isPending: removing } = useRemoveTrack(roomId);
  const { mutate: vote, isPending: voting } = useVoteTrack(roomId);

  function handleVote(type: "up" | "down") {
    const prevVote = song.userVote ?? null;
    const next: "up" | "down" | "remove" = prevVote === type ? "remove" : type;
    vote({
      songId: song.id,
      voteType: next,
    });
  }

  const canRemove = isOwner || song.addedById === currentUserId;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 10,
        background: isCurrent ? "rgba(163,190,140,0.08)" : "transparent",
        border: `1px solid ${isCurrent ? "rgba(163,190,140,0.2)" : "transparent"}`,
        transition: "background 0.15s",
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {song.thumbnail ? (
          <img
            src={song.thumbnail}
            alt=""
            width={48}
            height={36}
            style={{ borderRadius: 6, objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: 48, height: 36, borderRadius: 6, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7a8d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}
        {isCurrent && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: 6,
            background: "rgba(163,190,140,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {/* Animated playing bars */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#a3be8c">
              <rect x="1" y="8" width="3" height="8" rx="1">
                <animate attributeName="height" values="8;14;8" dur="0.8s" repeatCount="indefinite" />
                <animate attributeName="y" values="8;2;8" dur="0.8s" repeatCount="indefinite" />
              </rect>
              <rect x="6" y="4" width="3" height="12" rx="1">
                <animate attributeName="height" values="12;6;12" dur="0.8s" begin="0.2s" repeatCount="indefinite" />
                <animate attributeName="y" values="4;10;4" dur="0.8s" begin="0.2s" repeatCount="indefinite" />
              </rect>
              <rect x="11" y="6" width="3" height="10" rx="1">
                <animate attributeName="height" values="10;14;10" dur="0.8s" begin="0.4s" repeatCount="indefinite" />
                <animate attributeName="y" values="6;2;6" dur="0.8s" begin="0.4s" repeatCount="indefinite" />
              </rect>
            </svg>
          </div>
        )}
      </div>

      {/* Title + duration */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: isCurrent ? 600 : 400,
          color: isCurrent ? "#a3be8c" : "#d8dee9",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {song.title}
        </p>
        <div style={{ display: "flex", alignItems: "center", marginTop: 2 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#6b7a8d" }}>{fmtMs(song.durationMs)}</p>
          {song.addedBy && (
            <>
              <span style={{ margin: "0 6px", fontSize: 11, color: "#4c566a" }}>•</span>
              <p style={{ margin: 0, fontSize: 11, color: "#81a1c1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Added by {song.addedBy.name || song.addedBy.username || "Unknown"}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Vote score */}
      <span style={{ fontSize: 11, color: song.voteScore > 0 ? "#a3be8c" : song.voteScore < 0 ? "#bf616a" : "#6b7a8d", fontWeight: 600, flexShrink: 0 }}>
        {song.voteScore > 0 ? `+${song.voteScore}` : song.voteScore}
      </span>

      {/* Vote buttons */}
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        <button
          onClick={() => handleVote("up")}
          disabled={voting}
          title="Upvote"
          style={{
            padding: "4px 7px", borderRadius: 6, border: "none", cursor: "pointer",
            background: song.userVote === "up" ? "rgba(163,190,140,0.25)" : "rgba(255,255,255,0.04)",
            color: song.userVote === "up" ? "#a3be8c" : "#6b7a8d",
            fontSize: 13, transition: "all 0.12s",
            opacity: voting ? 0.5 : 1,
          }}
        >
          ▲
        </button>
        <button
          onClick={() => handleVote("down")}
          disabled={voting}
          title="Downvote"
          style={{
            padding: "4px 7px", borderRadius: 6, border: "none", cursor: "pointer",
            background: song.userVote === "down" ? "rgba(191,97,106,0.2)" : "rgba(255,255,255,0.04)",
            color: song.userVote === "down" ? "#bf616a" : "#6b7a8d",
            fontSize: 13, transition: "all 0.12s",
            opacity: voting ? 0.5 : 1,
          }}
        >
          ▼
        </button>
      </div>

      {/* Remove */}
      {canRemove && (
        <button
          onClick={() => removeTrack(song.id)}
          disabled={removing}
          title="Remove"
          style={{
            padding: "4px 6px", borderRadius: 6, border: "none",
            background: "transparent", color: "#6b7a8d",
            cursor: removing ? "not-allowed" : "pointer",
            opacity: removing ? 0.5 : 1,
            display: "flex", alignItems: "center", transition: "color 0.12s", flexShrink: 0,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#bf616a")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#6b7a8d")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      )}
    </div>
  );
});
