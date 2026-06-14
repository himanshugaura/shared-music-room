import { api } from "@/api/axios";
import type {
  AddTrackPayload,
  CreateRoomPayload,
  JoinedRoomsResponse,
  QueueSong,
  QueueState,
  Room,
  RoomSummary,
} from "@/types/room";

const BASE = `${process.env.NEXT_PUBLIC_BASE_URL}/api`;

export const roomService = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  getOwnedRooms: async (): Promise<RoomSummary[]> => {
    const { data } = await api.get(`${BASE}/user/me/rooms/owned`);
    return data.data;
  },

  getJoinedRooms: async (): Promise<JoinedRoomsResponse> => {
    const { data } = await api.get(`${BASE}/user/me/rooms/joined`);
    return data.data;
  },

  createRoom: async (payload: CreateRoomPayload): Promise<RoomSummary> => {
    const { data } = await api.post(`${BASE}/rooms`, payload);
    return data.data;
  },

  joinByCode: async (roomCode: string): Promise<void> => {
    await api.post(`${BASE}/rooms/join/${roomCode.trim().toUpperCase()}`);
  },

  deleteRoom: async (roomId: string): Promise<void> => {
    await api.delete(`${BASE}/rooms/${roomId}`);
  },

  // ── Room page ─────────────────────────────────────────────────────────────
  getRoom: async (roomId: string): Promise<Room> => {
    const { data } = await api.get(`${BASE}/rooms/${roomId}`);
    return data.data;
  },

  getQueue: async (roomId: string): Promise<QueueState> => {
    const { data } = await api.get(`${BASE}/rooms/${roomId}/queue`);
    return data.data;
  },

  addTrack: async (roomId: string, payload: AddTrackPayload): Promise<QueueSong> => {
    const { data } = await api.post(`${BASE}/rooms/${roomId}/queue/tracks`, payload);
    return data.data;
  },

  removeTrack: async (roomId: string, songId: string): Promise<void> => {
    await api.delete(`${BASE}/rooms/${roomId}/queue/tracks/${songId}`);
  },

  voteTrack: async (
    roomId: string,
    songId: string,
    voteType: "up" | "down" | "remove"
  ): Promise<QueueSong> => {
    const { data } = await api.post(
      `${BASE}/rooms/${roomId}/queue/tracks/${songId}/vote`,
      { voteType }
    );
    return data.data;
  },

  updateQueueSettings: async (
    roomId: string,
    settings: { shuffleEnabled: boolean }
  ): Promise<void> => {
    await api.patch(`${BASE}/rooms/${roomId}/queue/settings`, settings);
  },
};
