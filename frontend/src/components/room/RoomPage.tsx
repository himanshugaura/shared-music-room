"use client";

/**
 * RoomPage — top-level client component for /room/[roomId].
 *
 * Responsibilities:
 *  • Fetch room details and initial queue state (REST via React-Query)
 *  • Determine owner vs member role
 *  • Wire socket events to YouTube player imperative controls
 *  • Expose typed emit helpers to PlayerPanel via callbacks
 *  • Compose RoomHeader, PlayerPanel, QueuePanel
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/store";
import { useRoomDetails, useQueue, roomKeys } from "@/hooks/useRoom";
import { useRoomSocket } from "@/hooks/useRoomSocket";

import { RoomHeader } from "./RoomHeader";
import { PlayerPanel, type PlayerControls } from "./PlayerPanel";
import { QueuePanel } from "./QueuePanel";
import type { QueueState } from "@/types/room";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Compute the real playback position accounting for server time offset. */
function calcPosition(q: QueueState): number {
  if (!q.isPlaying || !q.playbackStartedAt) return q.currentPositionMs / 1000;
  const elapsed = Date.now() - new Date(q.playbackStartedAt).getTime();
  return Math.max(0, (q.currentPositionMs + elapsed) / 1000);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RoomPage({ roomId }: { roomId: string }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data: room, isLoading: roomLoading, isError: roomError } = useRoomDetails(roomId);
  const { data: queue, isLoading: queueLoading } = useQueue(roomId);

  const isOwner = !!room && !!user && room.ownerId === user.id;
  const currentSong = queue?.songs.find((s) => s.id === queue.currentQueueSongId) ?? null;

  // Ref exposing imperative player controls (set by PlayerPanel)
  const controlRef = useRef<PlayerControls | null>(null);

  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // ── Initial sync: load current song at correct position once queue arrives ──

  const didInitRef = useRef(false);
  useEffect(() => {
    if (!queue || !controlRef.current || !isPlayerReady || didInitRef.current) return;

    const { currentQueueSongId, songs, isPlaying } = queue;
    if (!currentQueueSongId) return;

    const song = songs.find((s) => s.id === currentQueueSongId);
    if (!song) return;

    didInitRef.current = true;
    const startSeconds = calcPosition(queue);
    controlRef.current.loadVideo(song.youtubeVideoId, startSeconds, isPlaying);
  }, [queue, isPlayerReady]);

  // ── Socket event handlers ─────────────────────────────────────────────────

  const handleSocketPlay = useCallback((serverAt: number) => {
    const lagMs = Date.now() - serverAt;
    controlRef.current?.play();
    // Compensate for lag by seeking slightly forward
    if (lagMs > 100) {
      setTimeout(() => controlRef.current?.seekTo((controlRef.current as unknown as { getCurrentTime?: () => number }).getCurrentTime?.() ?? 0 + lagMs / 1000), 200);
    }
  }, []);

  const handleSocketPause = useCallback((positionMs: number) => {
    controlRef.current?.pause();
    controlRef.current?.seekTo(positionMs / 1000);
  }, []);

  const handleSocketSeek = useCallback((positionMs: number) => {
    controlRef.current?.seekTo(positionMs / 1000);
  }, []);

  const handleSocketSkip = useCallback(
    (nextSongId: string | null, serverAt: number) => {
      // Update queue cache so the UI reflects the new current song
      qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
        if (!prev) return prev;
        const currentSongId = prev.currentQueueSongId;
        const remainingSongs = prev.songs.filter(s => s.id !== currentSongId);
        return { ...prev, currentQueueSongId: nextSongId, songs: remainingSongs, isPlaying: nextSongId ? true : false };
      });

      if (nextSongId) {
        const song = queue?.songs.find((s) => s.id === nextSongId);
        if (song) {
          const lag = Math.max(0, (Date.now() - serverAt) / 1000);
          controlRef.current?.loadVideo(song.youtubeVideoId, lag);
        }
      } else {
        controlRef.current?.pause();
      }
    },
    [queue, qc, roomId]
  );

  // Socket wiring
  const { emitPlay, emitPause, emitSeek, emitSkip } = useRoomSocket(roomId, {
    onPlay: handleSocketPlay,
    onPause: handleSocketPause,
    onSeek: handleSocketSeek,
    onSkip: handleSocketSkip,
  });

  // ── Owner control handlers (emit + local player) ──────────────────────────

  const handlePlay = useCallback(() => {
    emitPlay();
    // Note: local player.playVideo() is called by socket's own echo handler
    // but we optimistically play locally here for the owner
    controlRef.current?.play();
  }, [emitPlay]);

  const handlePause = useCallback((positionMs: number) => {
    controlRef.current?.pause();
    emitPause(positionMs);
  }, [emitPause]);

  const handleSeek = useCallback((positionMs: number) => {
    controlRef.current?.seekTo(positionMs / 1000);
    emitSeek(positionMs);
  }, [emitSeek]);

  const handleSkip = useCallback(() => {
    if (!currentSong) return;
    emitSkip(currentSong.id);
  }, [currentSong, emitSkip]);

  const handleEnded = useCallback(() => {
    if (isOwner && currentSong) {
      emitSkip(currentSong.id);
    }
  }, [isOwner, currentSong, emitSkip]);

  // ── Render states ────────────────────────────────────────────────────────

  if (roomLoading || queueLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0f16", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg className="animate-spin" width="36" height="36" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <path d="M12 2A10 10 0 0 1 22 12" stroke="#a3be8c" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (roomError || !room) {
    return (
      <div style={{ minHeight: "100vh", background: "#0b0f16", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#eceff4" }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#bf616a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Room not found</p>
          <p style={{ margin: "6px 0 16px", fontSize: 13, color: "#6b7a8d" }}>
            This room doesn&apos;t exist or you don&apos;t have access.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#a3be8c", color: "#0f1117", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0b0f16",
        overflow: "hidden",
      }}
    >
      <RoomHeader
        room={room}
        queue={queue}
        isOwner={isOwner}
      />

      {/* Main content: player left, queue right */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          minHeight: 0,
          overflow: "hidden",
        }}
        className="room-grid"
      >
        <PlayerPanel
          currentSong={currentSong}
          queueState={queue ?? null}
          isOwner={isOwner}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          onSkip={handleSkip}
          onEnded={handleEnded}
          controlRef={controlRef}
          onPlayerReady={() => setIsPlayerReady(true)}
        />

        <QueuePanel
          roomId={roomId}
          queue={queue}
          currentUserId={user?.id ?? ""}
          isOwner={isOwner}
        />
      </div>

      {/* Responsive: stack on small screens */}
      <style>{`
        @media (max-width: 768px) {
          .room-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}
