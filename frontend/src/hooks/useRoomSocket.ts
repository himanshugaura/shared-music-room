"use client";

/**
 * useRoomSocket — wires up all Socket.IO events for a single room session.
 *
 * Responsibilities:
 *  • Join the socket room on mount / leave on unmount
 *  • Forward player events (play / pause / seek / skip) via stable callbacks
 *  • Keep the React-Query queue cache in sync when songs are added
 *  • Expose typed emit helpers for the owner's player controls
 */

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getSocket } from "./useSocket";
import { roomKeys } from "./useRoom";
import type { Socket } from "socket.io-client";
import type { QueueSong, QueueState } from "@/types/room";

// ── Callback types ────────────────────────────────────────────────────────────

export interface RoomSocketCallbacks {
  /** Server confirmed play; `serverAt` is server timestamp for lag correction */
  onPlay?: (serverAt: number) => void;
  onPause?: (positionMs: number) => void;
  onSeek?: (positionMs: number) => void;
  /** nextSongId is null when queue is exhausted */
  onSkip?: (nextSongId: string | null, serverAt: number) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRoomSocket(roomId: string, callbacks: RoomSocketCallbacks = {}) {
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  // Always reference the latest callbacks without re-registering listeners
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  // ── Join / leave ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId) return;
    let mounted = true;

    getSocket().then((socket) => {
      if (!mounted) return;
      socketRef.current = socket;

      if (!socket.connected) socket.connect();

      socket.emit(
        "room:join",
        { roomId },
        (res: { ok: boolean; message?: string }) => {
          if (!res?.ok) toast.error(res?.message ?? "Could not join room.");
        }
      );

      // ── Player event listeners ─────────────────────────────────────────────

      const onPlay = ({ at }: { at: number }) =>
        cbRef.current.onPlay?.(at);

      const onPause = ({ currentPositionMs }: { currentPositionMs: number }) =>
        cbRef.current.onPause?.(currentPositionMs);

      const onSeek = ({ positionMs }: { positionMs: number }) =>
        cbRef.current.onSeek?.(positionMs);

      const onSkip = ({
        nextSongId,
        at,
      }: {
        nextSongId: string | null;
        at: number;
      }) => cbRef.current.onSkip?.(nextSongId, at);

      // ── Queue event listeners ──────────────────────────────────────────────

      const onSongAdded = ({ song }: { song: QueueSong }) => {
        qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
          if (!prev) return prev;
          // Guard against duplicates (REST mutation may have appended it already)
          if (prev.songs.some((s) => s.id === song.id)) return prev;
          
          const isFirst = prev.songs.length === 0;
          return {
            ...prev,
            songs: [...prev.songs, song],
            currentQueueSongId: isFirst ? song.id : prev.currentQueueSongId,
            isPlaying: isFirst ? true : prev.isPlaying,
            currentPositionMs: isFirst ? 0 : prev.currentPositionMs,
          };
        });
      };

      const onSongVoted = ({ song }: { song: QueueSong }) => {
        qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
          if (!prev) return prev;
          
          return {
            ...prev,
            songs: prev.songs.map((s) => s.id === song.id ? { ...s, upVotes: song.upVotes, downVotes: song.downVotes, voteScore: song.voteScore } : s),
          };
        });
      };

      const onSongDeleted = ({ songId }: { songId: string }) => {
        qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            songs: prev.songs.filter((s) => s.id !== songId),
          };
        });
      };

      socket.on("player:play", onPlay);
      socket.on("player:pause", onPause);
      socket.on("player:seek", onSeek);
      socket.on("player:skip", onSkip);
      socket.on("queue:song_added", onSongAdded);
      socket.on("queue:song_voted", onSongVoted);
      socket.on("queue:song_deleted", onSongDeleted);

      // ── Cleanup ────────────────────────────────────────────────────────────

      return () => {
        socket.emit("room:leave", { roomId });
        socket.off("player:play", onPlay);
        socket.off("player:pause", onPause);
        socket.off("player:seek", onSeek);
        socket.off("player:skip", onSkip);
        socket.off("queue:song_added", onSongAdded);
        socket.off("queue:song_voted", onSongVoted);
        socket.off("queue:song_deleted", onSongDeleted);
      };
    });

    return () => { mounted = false; };
  }, [roomId, qc]);

  // ── Owner emit helpers ────────────────────────────────────────────────────

  const emitPlay = useCallback(() => {
    socketRef.current?.emit("player:play", { roomId });
  }, [roomId]);

  const emitPause = useCallback((currentPositionMs: number) => {
    socketRef.current?.emit("player:pause", { roomId, currentPositionMs });
  }, [roomId]);

  const emitSeek = useCallback((positionMs: number) => {
    socketRef.current?.emit("player:seek", { roomId, positionMs });
  }, [roomId]);

  const emitSkip = useCallback((currentSongId: string) => {
    socketRef.current?.emit("player:skip", { roomId, currentSongId });
  }, [roomId]);

  return { emitPlay, emitPause, emitSeek, emitSkip };
}
