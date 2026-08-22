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
    staleTime: Infinity, // WebSockets handle live updates, no polling needed
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useAddTrack(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddTrackPayload) => roomService.addTrack(roomId, payload),
    onSuccess: (song) => {
      qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
        if (!prev) return prev;
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
    
    // 1. Optimistic update — happens instantly on click
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: roomKeys.queue(roomId) });
      const previousState = qc.getQueryData<QueueState>(roomKeys.queue(roomId));

      if (previousState) {
        qc.setQueryData<QueueState>(roomKeys.queue(roomId), (prev) => {
          if (!prev) return prev;

          // Compute optimistic deltas
          let newSongs = prev.songs.map((s) => {
            if (s.id !== variables.songId) return s;
            const prevVote = s.userVote;
            const upDelta = variables.voteType === "up" ? 1 : prevVote === "up" ? -1 : 0;
            const downDelta = variables.voteType === "down" ? 1 : prevVote === "down" ? -1 : 0;
            return {
              ...s,
              upVotes: s.upVotes + upDelta,
              downVotes: s.downVotes + downDelta,
              voteScore: s.voteScore + upDelta - downDelta,
              userVote: variables.voteType === "remove" ? null : variables.voteType,
            };
          });

          // We no longer automatically re-sort on every vote. 
          // The song just updates its score in place.
          // Sorting is now a manual admin action.
          newSongs.sort((a, b) => a.position - b.position);

          return { ...prev, songs: newSongs };
        });
      }

      return { previousState };
    },

    // 2. Revert on failure
    onError: (err, variables, context) => {
      if (context?.previousState) {
        qc.setQueryData(roomKeys.queue(roomId), context.previousState);
      }
      toast.error(msg(err, "Vote failed."));
    },
  });
}

export function useSortQueueByVotes(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => roomService.sortQueueByVotes(roomId),
    onSuccess: () => {
      // Invalidate so we pull the newly sorted list directly from the server.
      qc.invalidateQueries({ queryKey: roomKeys.queue(roomId) });
      toast.success(`Queue sorted by votes.`);
    },
    onError: (err) => toast.error(msg(err, "Could not sort queue.")),
  });
}
