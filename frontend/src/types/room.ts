export type Visibility = "public" | "private";

export interface RoomSummary {
  id: string;
  name: string;
  roomCode: string;
  visibility: Visibility;
  description?: string | null;
  createdAt: string;
}

export interface Room extends RoomSummary {
  ownerId: string;
  updatedAt: string;
}

export interface JoinedRoomsResponse {
  member: RoomSummary[];
}

export interface CreateRoomPayload {
  name: string;
  description?: string;
  visibility: Visibility;
  shuffleEnabled?: boolean;
}

// ── Queue ──────────────────────────────────────────────────────────────────

export interface QueueSong {
  id: string;
  queueId: string;
  youtubeVideoId: string;
  title: string;
  thumbnail: string | null;
  durationMs: number;
  position: number;
  upVotes: number;
  downVotes: number;
  voteScore: number;
  userVote?: "up" | "down" | null;
  addedById: string;
  addedBy: {
    username: string | null;
    name: string | null;
    avatarUrl: string | null;
  };
  addedAt: string;
}

export interface QueueState {
  id: string;
  roomId: string;
  currentQueueSongId: string | null;
  currentPositionMs: number;
  playbackStartedAt: string | null;
  isPlaying: boolean;
  shuffleEnabled: boolean;
  songs: QueueSong[];
}

export interface AddTrackPayload {
  youtubeVideoId: string;
  title: string;
  thumbnail?: string | null;
  durationMs: number;
}
