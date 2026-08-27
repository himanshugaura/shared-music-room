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

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getSocket } from "./useSocket";
import { roomKeys } from "./useRoom";
import { useAuthStore } from "@/store";
import type { Socket } from "socket.io-client";
import type { OnlineUser, QueueSong, QueueState } from "@/types/room";

export interface RoomSocketCallbacks {
  /** Server confirmed play; `serverAt` is server timestamp for lag correction */
  onPlay?: (serverAt: number) => void;
  onPause?: (positionMs: number) => void;
  onSeek?: (positionMs: number) => void;
  /** nextSongId is null when queue is exhausted */
  onSkip?: (nextSongId: string | null, serverAt: number, previousSongId?: string | null) => void;
  /** Fired when the server fast-forwarded the queue — may have skipped multiple songs */
  onSync?: (currentQueueSongId: string | null, positionMs: number, playbackStartedAt: string | null, serverAt: number) => void;
}

export interface SkipVoteState {
  currentVotes: number;
  requiredVotes: number;
  hasVoted: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRoomSocket(roomId: string, callbacks: RoomSocketCallbacks = {}) {
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [skipVotes, setSkipVotes] = useState<SkipVoteState>({
    currentVotes: 0,
    requiredVotes: 1,
    hasVoted: false,
  });
  
  // Retrieve current user ID to deduplicate self-triggered optimistic events
  const currentUserId = useAuthStore((s) => s.user?.id);

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

      const joinRoom = () => {
        socket.emit(
          "room:join",
          { roomId },
          (res: { ok: boolean; message?: string; data?: { roomId: string; onlineUsers?: OnlineUser[] } }) => {
            if (!res?.ok) {
              toast.error(res?.message ?? "Could not join room.");
            } else if (res.data?.onlineUsers) {
              setOnlineUsers(res.data.onlineUsers);
            }
          }
        );
      };

      if (!socket.connected) {
        socket.connect();
      } else {
        joinRoom();
      }

      socket.on("connect", joinRoom);

      // ── Player event listeners ─────────────────────────────────────────────

      const onPlay = ({ at }: { at: number }) => {
        qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
          if (!prev) return prev;
          return { ...prev, isPlaying: true, playbackStartedAt: new Date(at).toISOString() };
        });
        cbRef.current.onPlay?.(at);
      };

      const onPause = ({ currentPositionMs }: { currentPositionMs: number }) => {
        qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
          if (!prev) return prev;
          return { ...prev, isPlaying: false, currentPositionMs };
        });
        cbRef.current.onPause?.(currentPositionMs);
      };

      const onSeek = ({ positionMs, at }: { positionMs: number; at: number }) => {
        qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
          if (!prev) return prev;
          return { ...prev, currentPositionMs: positionMs, playbackStartedAt: new Date(at).toISOString() };
        });
        cbRef.current.onSeek?.(positionMs);
      };

      const onSkip = ({
        previousSongId,
        nextSongId,
        at,
      }: {
        previousSongId?: string | null;
        nextSongId: string | null;
        at: number;
      }) => cbRef.current.onSkip?.(nextSongId, at, previousSongId);

      // ── Queue event listeners ──────────────────────────────────────────────

      const onSongAdded = ({
        song,
        autoStarted,
      }: {
        song: QueueSong;
        autoStarted?: boolean;
      }) => {
        qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
          if (!prev) return prev;
          // Guard against duplicates (REST mutation may have appended it already)
          if (prev.songs.some((s) => s.id === song.id)) return prev;
          
          const isFirst = autoStarted ?? (!prev.currentQueueSongId || prev.songs.length === 0);
          return {
            ...prev,
            songs: [...prev.songs, song],
            currentQueueSongId: isFirst ? song.id : prev.currentQueueSongId,
            isPlaying: isFirst ? true : prev.isPlaying,
            currentPositionMs: isFirst ? 0 : prev.currentPositionMs,
          };
        });
      };

      const onSongVoted = ({ song, userId }: { song: QueueSong; userId: string }) => {
        // If we triggered this vote, our optimistic UI already handled it perfectly.
        // Ignoring the socket event entirely prevents any possibility of flickering.
        if (userId === currentUserId) return;

        qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
          if (!prev) return prev;
          
          return {
            ...prev,
            songs: prev.songs.map((s) => s.id === song.id ? { ...s, upVotes: song.upVotes, downVotes: song.downVotes, voteScore: song.voteScore } : s),
          };
        });
      };

      const onQueueUpdated = ({ queue }: { queue: QueueState }) => {
        qc.setQueryData<QueueState>(roomKeys.queue(roomId), queue);
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

      const onSync = (payload: { roomId: string; isPlaying: boolean; currentQueueSongId: string | null; currentPositionMs: number; playbackStartedAt: string | null; at: number }) => {
        // Update cache: remove all songs that were skipped (everything before the new current song).
        // syncQueueTimeline already deleted them from Postgres, so we mirror that here.
        qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
          if (!prev) return prev;
          
          if (!payload.currentQueueSongId) {
            // Queue exhausted
            return { ...prev, isPlaying: false, currentQueueSongId: null, songs: [], currentPositionMs: 0, playbackStartedAt: null };
          }

          const newIdx = prev.songs.findIndex((s) => s.id === payload.currentQueueSongId);
          // Slice: keep from the new current song onward (the server already deleted the ones before it)
          const remainingSongs = newIdx >= 0 ? prev.songs.slice(newIdx) : prev.songs;
          
          return {
            ...prev,
            isPlaying: payload.isPlaying,
            currentQueueSongId: payload.currentQueueSongId,
            currentPositionMs: payload.currentPositionMs,
            playbackStartedAt: payload.playbackStartedAt,
            songs: remainingSongs,
          };
        });

        // Delegate the actual video load to RoomPage via the onSync callback
        cbRef.current.onSync?.(payload.currentQueueSongId, payload.currentPositionMs, payload.playbackStartedAt, payload.at);
      };

      // ── Member presence event listeners ────────────────────────────────────

      const onMemberJoined = (payload: { user: OnlineUser; roomId: string; onlineUsers?: OnlineUser[] }) => {
        if (payload.onlineUsers) {
          setOnlineUsers(payload.onlineUsers);
        } else {
          setOnlineUsers((prev) => {
            if (prev.some((u) => u.id === payload.user.id)) return prev;
            return [...prev, payload.user];
          });
        }
      };

      const onMemberLeft = (payload: { userId: string; roomId: string; onlineUsers?: OnlineUser[] }) => {
        if (payload.onlineUsers) {
          setOnlineUsers(payload.onlineUsers);
        } else {
          setOnlineUsers((prev) => prev.filter((u) => u.id !== payload.userId));
        }
      };

      const onOnlineUsersUpdated = (payload: { roomId: string; onlineUsers: OnlineUser[] }) => {
        if (payload.onlineUsers) {
          setOnlineUsers(payload.onlineUsers);
        }
      };

      const onSkipVotesUpdated = (payload: {
        roomId: string;
        currentVotes: number;
        requiredVotes: number;
        userIds: string[];
      }) => {
        setSkipVotes({
          currentVotes: payload.currentVotes,
          requiredVotes: payload.requiredVotes,
          hasVoted: !!currentUserId && payload.userIds.includes(currentUserId),
        });
      };

      socket.on("player:play", onPlay);
      socket.on("player:pause", onPause);
      socket.on("player:seek", onSeek);
      socket.on("player:skip", (payload) => {
        setSkipVotes((prev) => ({ ...prev, currentVotes: 0, hasVoted: false }));
        onSkip(payload);
      });
      socket.on("player:sync", (payload) => {
        setSkipVotes((prev) => ({ ...prev, currentVotes: 0, hasVoted: false }));
        onSync(payload);
      });
      socket.on("player:skip_votes_updated", onSkipVotesUpdated);
      socket.on("queue:song_added", onSongAdded);
      socket.on("queue:song_voted", onSongVoted);
      socket.on("queueUpdated", onQueueUpdated);
      socket.on("queue:song_deleted", onSongDeleted);
      socket.on("room:online_users_updated", onOnlineUsersUpdated);
      socket.on("room:member_joined", onMemberJoined);
      socket.on("room:member_left", onMemberLeft);

      // ── Cleanup ────────────────────────────────────────────────────────────

      return () => {
        socket.off("connect", joinRoom);
        socket.emit("room:leave", { roomId });
        socket.off("player:play", onPlay);
        socket.off("player:pause", onPause);
        socket.off("player:seek", onSeek);
        socket.off("player:skip");
        socket.off("player:sync");
        socket.off("player:skip_votes_updated", onSkipVotesUpdated);
        socket.off("queue:song_added", onSongAdded);
        socket.off("queue:song_voted", onSongVoted);
        socket.off("queueUpdated", onQueueUpdated);
        socket.off("queue:song_deleted", onSongDeleted);
        socket.off("room:online_users_updated", onOnlineUsersUpdated);
        socket.off("room:member_joined", onMemberJoined);
        socket.off("room:member_left", onMemberLeft);
      };
    });

    return () => { mounted = false; };
  }, [roomId, qc, currentUserId]);

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

  const emitRequestSync = useCallback(() => {
    socketRef.current?.emit("player:request_sync", { roomId });
  }, [roomId]);

  const emitVoteSkip = useCallback(() => {
    socketRef.current?.emit(
      "player:vote_skip",
      { roomId },
      (res: { ok: boolean; message?: string; data?: { hasVoted: boolean; currentVotes: number; requiredVotes: number } }) => {
        if (!res?.ok) {
          toast.error(res?.message ?? "Could not vote to skip.");
        } else if (res.data) {
          setSkipVotes((prev) => ({
            ...prev,
            hasVoted: res.data!.hasVoted,
            currentVotes: res.data!.currentVotes,
            requiredVotes: res.data!.requiredVotes,
          }));
        }
      }
    );
  }, [roomId]);

  return {
    emitPlay,
    emitPause,
    emitSeek,
    emitSkip,
    emitRequestSync,
    emitVoteSkip,
    onlineUsers,
    skipVotes,
  };
}
