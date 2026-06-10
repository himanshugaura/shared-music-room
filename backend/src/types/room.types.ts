import type { Visibility } from '@prisma/client';

export interface CreateRoomInput {
  name: string;
  description?: string | null;
  visibility: Visibility;
  userId: string;
  shuffleEnabled?: boolean;
}

export interface RoomSummary {
  id: string;
  name: string;
  roomCode: string;
  visibility: Visibility;
  createdAt: Date;
}

export interface JoinedRoomsResponse {
  member: RoomSummary[];
}
