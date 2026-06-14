"use client";

/**
 * React-Query hooks for room REST data.
 * All toast notifications live here so components stay clean.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { roomService } from "@/services/room.service";
import type { AddTrackPayload, QueueSong, QueueState } from "@/types/room";

function msg(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  );
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const roomKeys = {
  detail: (id: string) => ["room", id] as const,
  queue: (id: string) => ["room", id, "queue"] as const,
};

// ── Queries ───────────────────────────────────────────────────────────────────

export function useRoomDetails(roomId: string) {
  return useQuery({
    queryKey: roomKeys.detail(roomId),
    queryFn: () => roomService.getRoom(roomId),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useQueue(roomId: string) {
  return useQuery({
    queryKey: roomKeys.queue(roomId),
    queryFn: () => roomService.getQueue(roomId),
    staleTime: Infinity, // Socket events keep it fresh
    refetchOnWindowFocus: false,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useAddTrack(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddTrackPayload) => roomService.addTrack(roomId, payload),
    onSuccess: (song) => {
      // Optimistic append — socket event may also arrive; de-duplication is
      // handled in useRoomSocket.
      qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
        if (!prev) return prev;
        const isFirst = prev.songs.length === 0;
        return {
          ...prev,
          songs: [...prev.songs, song],
          currentQueueSongId: isFirst ? song.id : prev.currentQueueSongId,
          isPlaying: isFirst ? true : prev.isPlaying,
          currentPositionMs: isFirst ? 0 : prev.currentPositionMs,
        };
      });
      toast.success("Added to queue!");
    },
    onError: (err) => toast.error(msg(err, "Failed to add track.")),
  });
}

export function useRemoveTrack(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (songId: string) => roomService.removeTrack(roomId, songId),
    onSuccess: (_, songId) => {
      qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) =>
        prev
          ? { ...prev, songs: prev.songs.filter((s) => s.id !== songId) }
          : prev
      );
      toast.success("Track removed.");
    },
    onError: (err) => toast.error(msg(err, "Failed to remove track.")),
  });
}

export function useVoteTrack(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      songId,
      voteType,
    }: {
      songId: string;
      voteType: "up" | "down" | "remove";
    }) => roomService.voteTrack(roomId, songId, voteType),
    onSuccess: (updated: QueueSong) => {
      qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) =>
        prev
          ? { ...prev, songs: prev.songs.map((s) => (s.id === updated.id ? updated : s)) }
          : prev
      );
    },
    onError: (err) => toast.error(msg(err, "Vote failed.")),
  });
}

export function useUpdateQueueSettings(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: { shuffleEnabled: boolean }) =>
      roomService.updateQueueSettings(roomId, settings),
    onSuccess: (_, vars) => {
      qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) =>
        prev ? { ...prev, shuffleEnabled: vars.shuffleEnabled } : prev
      );
      toast.success(`Shuffle ${vars.shuffleEnabled ? "on" : "off"}.`);
    },
    onError: (err) => toast.error(msg(err, "Could not update settings.")),
  });
}
