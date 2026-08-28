"use client";

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

function calcPosition(q: QueueState): number {
  if (!q.isPlaying || !q.playbackStartedAt) return q.currentPositionMs / 1000;
  const elapsed = Date.now() - new Date(q.playbackStartedAt).getTime();
  return Math.max(0, (q.currentPositionMs + elapsed) / 1000);
}

export function RoomPage({ roomId }: { roomId: string }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { data: room, isLoading: roomLoading, isError: roomError } = useRoomDetails(roomId);
  const { data: queue, isLoading: queueLoading } = useQueue(roomId);

  const isOwner = !!room && !!user && room.ownerId === user.id;
  const currentSong = queue?.songs.find((s) => s.id === queue.currentQueueSongId) ?? null;

  const controlRef = useRef<PlayerControls | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const loadedSongIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!controlRef.current || !isPlayerReady) return;

    if (!currentSong) {
      if (loadedSongIdRef.current) {
        controlRef.current.pause();
        loadedSongIdRef.current = null;
      }
      return;
    }

    if (loadedSongIdRef.current !== currentSong.id) {
      loadedSongIdRef.current = currentSong.id;
      const rawPosition = calcPosition(queue!);
      const startSeconds = rawPosition < 2 ? 0 : rawPosition;
      controlRef.current.loadVideo(
        currentSong.youtubeVideoId,
        startSeconds,
        queue?.isPlaying ?? true
      );
    }
  }, [currentSong?.id, isPlayerReady, queue?.isPlaying]);

  const handleSocketPlay = useCallback((serverAt: number) => {
    const lagMs = Date.now() - serverAt;
    const freshQueue = qc.getQueryData<QueueState>(roomKeys.queue(roomId));
    const activeSong = freshQueue?.songs.find((s) => s.id === freshQueue.currentQueueSongId);

    if (activeSong && loadedSongIdRef.current !== activeSong.id) {
      loadedSongIdRef.current = activeSong.id;
      const rawPos = calcPosition(freshQueue!);
      const startSec = rawPos < 2 ? 0 : rawPos;
      controlRef.current?.loadVideo(activeSong.youtubeVideoId, startSec, true);
    } else {
      controlRef.current?.play();
      if (lagMs > 100) {
        setTimeout(() => {
          const cur = controlRef.current?.getCurrentTime() ?? 0;
          controlRef.current?.seekTo(Math.max(0, cur + lagMs / 1000));
        }, 200);
      }
    }
  }, [qc, roomId]);

  const handleSocketPause = useCallback((positionMs: number) => {
    controlRef.current?.pause();
    controlRef.current?.seekTo(positionMs / 1000);
  }, []);

  const handleSocketSeek = useCallback((positionMs: number) => {
    controlRef.current?.seekTo(positionMs / 1000);
  }, []);

  const handleSocketSkip = useCallback(
    (nextSongId: string | null, serverAt: number, previousSongId?: string | null) => {
      const nowIso = new Date(serverAt).toISOString();

      qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
        if (!prev) return prev;
        const currentSongId = previousSongId ?? prev.currentQueueSongId;
        const remainingSongs = prev.songs.filter((s) => s.id !== currentSongId);
        return {
          ...prev,
          currentQueueSongId: nextSongId,
          songs: remainingSongs,
          isPlaying: !!nextSongId,
          currentPositionMs: 0,
          playbackStartedAt: nextSongId ? nowIso : null,
        };
      });

      if (nextSongId) {
        const fresh = qc.getQueryData<QueueState>(roomKeys.queue(roomId));
        const song = fresh?.songs.find((s) => s.id === nextSongId);
        if (song) {
          loadedSongIdRef.current = song.id;
          const lag = Math.max(0, (Date.now() - serverAt) / 1000);
          const startSeconds = lag > 2 ? lag : 0;
          controlRef.current?.loadVideo(song.youtubeVideoId, startSeconds, true);
        }
      } else {
        loadedSongIdRef.current = null;
        controlRef.current?.pause();
      }
    },
    [qc, roomId]
  );

  const handleSocketSync = useCallback(
    (currentQueueSongId: string | null, positionMs: number, playbackStartedAt: string | null, serverAt: number) => {
      if (!currentQueueSongId) {
        loadedSongIdRef.current = null;
        controlRef.current?.pause();
        return;
      }
      const fresh = qc.getQueryData<QueueState>(roomKeys.queue(roomId));
      const song = fresh?.songs.find((s) => s.id === currentQueueSongId);
      if (!song) return;

      loadedSongIdRef.current = song.id;
      const elapsed = playbackStartedAt
        ? Math.max(0, (Date.now() - new Date(playbackStartedAt).getTime()) / 1000)
        : positionMs / 1000;
      controlRef.current?.loadVideo(song.youtubeVideoId, elapsed, true);
    },
    [qc, roomId]
  );

  const {
    emitPlay,
    emitPause,
    emitSeek,
    emitSkip,
    emitRequestSync,
    emitVoteSkip,
    onlineUsers,
    skipVotes,
  } = useRoomSocket(roomId, {
    onPlay: handleSocketPlay,
    onPause: handleSocketPause,
    onSeek: handleSocketSeek,
    onSkip: handleSocketSkip,
    onSync: handleSocketSync,
  });

  const skipInProgressRef = useRef(false);

  useEffect(() => {
    if (!queue || !queue.isPlaying || !currentSong) return;

    const interval = setInterval(() => {
      if (skipInProgressRef.current) return;

      const elapsedMs = queue.playbackStartedAt
        ? Date.now() - new Date(queue.playbackStartedAt).getTime()
        : 0;
      const currentPositionMs = queue.currentPositionMs + elapsedMs;

      if (currentPositionMs > currentSong.durationMs + 1000) {
        skipInProgressRef.current = true;
        emitRequestSync();
        setTimeout(() => { skipInProgressRef.current = false; }, 5000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [queue, currentSong, emitRequestSync]);

  const handlePlay = useCallback(() => {
    controlRef.current?.play();
    qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
      if (!prev) return prev;
      return { ...prev, isPlaying: true, playbackStartedAt: new Date().toISOString() };
    });
    emitPlay();
  }, [emitPlay, qc, roomId]);

  const handlePause = useCallback((positionMs: number) => {
    controlRef.current?.pause();
    qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
      if (!prev) return prev;
      return { ...prev, isPlaying: false, currentPositionMs: positionMs };
    });
    emitPause(positionMs);
  }, [emitPause, qc, roomId]);

  const handleSeek = useCallback((positionMs: number) => {
    controlRef.current?.seekTo(positionMs / 1000);
    qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
      if (!prev) return prev;
      return { ...prev, currentPositionMs: positionMs, playbackStartedAt: new Date().toISOString() };
    });
    emitSeek(positionMs);
  }, [emitSeek, qc, roomId]);

  const handleSkip = useCallback(() => {
    if (!currentSong) return;
    emitSkip(currentSong.id);
  }, [currentSong, emitSkip]);

  const handleEnded = useCallback(() => {
    if (currentSong && !skipInProgressRef.current) {
      skipInProgressRef.current = true;
      emitRequestSync();
      setTimeout(() => { skipInProgressRef.current = false; }, 5_000);
    }
  }, [currentSong, emitRequestSync]);

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
      className="room-root"
    >
      <RoomHeader
        room={room}
        queue={queue}
        isOwner={isOwner}
        onlineUsers={onlineUsers}
        currentUserId={user?.id}
      />

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
          skipVotes={skipVotes}
          onVoteSkip={emitVoteSkip}
        />

        <QueuePanel
          roomId={roomId}
          queue={queue}
          currentUserId={user?.id ?? ""}
          isOwner={isOwner}
        />
      </div>

      <style>{`
        @media (max-width: 768px) {
          .room-root {
            height: auto !important;
            overflow: visible !important;
            min-height: 100dvh;
          }
          .room-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .room-grid > section:first-child {
            height: auto !important;
            min-height: 0 !important;
          }
          .room-grid > section:first-child > div:first-child {
            flex: none !important;
            aspect-ratio: 16 / 9;
            min-height: 0 !important;
          }
          .room-grid > aside {
            height: auto !important;
            min-height: 300px;
            border-left: none !important;
            border-top: 1px solid rgba(255,255,255,0.06) !important;
          }
        }
      `}</style>
    </div>
  );
}
