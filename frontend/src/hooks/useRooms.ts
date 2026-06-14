import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roomService } from "@/services/room.service";
import type { CreateRoomPayload, RoomSummary } from "@/types/room";
import { toast } from "sonner";

function extractMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  );
}

const KEYS = {
  owned: ["rooms", "owned"] as const,
  joined: ["rooms", "joined"] as const,
};

export function useOwnedRooms() {
  return useQuery({
    queryKey: KEYS.owned,
    queryFn: roomService.getOwnedRooms,
    staleTime: 30_000,
  });
}

export function useJoinedRooms() {
  return useQuery({
    queryKey: KEYS.joined,
    queryFn: async () => {
      const res = await roomService.getJoinedRooms();
      return res.member;
    },
    staleTime: 30_000,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoomPayload) => roomService.createRoom(payload),
    onSuccess: (newRoom) => {
      qc.setQueryData<RoomSummary[]>(KEYS.owned, (prev = []) => [newRoom, ...prev]);
      toast.success(`Room "${newRoom.name}" created!`);
    },
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Failed to create room. Please try again."));
    },
  });
}

export function useJoinByCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => roomService.joinByCode(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.joined });
      toast.success("Successfully joined the room!");
    },
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Could not join room. Check the code and try again."));
    },
  });
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => roomService.deleteRoom(roomId),
    onSuccess: (_data, roomId) => {
      qc.setQueryData<RoomSummary[]>(KEYS.owned, (prev = []) =>
        prev.filter((r) => r.id !== roomId)
      );
      toast.success("Room deleted.");
    },
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Failed to delete room. Please try again."));
    },
  });
}
