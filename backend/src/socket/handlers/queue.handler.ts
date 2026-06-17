import type { Server } from 'socket.io';
import { type QueueSongWithUser } from '../../repositories/queueSong.repository.js';
import { addTrackToQueue } from '../../repositories/queueSong.repository.js';
import type { AckResponse, AuthenticatedSocket } from '../types.js';

type TrackPayload = {
  youtubeVideoId: string;
  title: string;
  thumbnail?: string | null;
  durationMs: number;
};

type QueueSongAddPayload = {
  roomId: string;
  track: TrackPayload;
};

export const registerQueueHandlers = (io: Server, socket: AuthenticatedSocket): void => {
  socket.on(
    'queue:song_add',
    async (
      { roomId, track }: QueueSongAddPayload,
      ack?: (res: AckResponse<QueueSongWithUser>) => void,
    ) => {
      try {
        const song = await addTrackToQueue(roomId, {
          ...track,
          addedById: socket.user.id,
        });

        io.to(roomId).emit('queue:song_added', { roomId, song });

        ack?.({ ok: true, data: song });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add song';
        ack?.({ ok: false, message });
      }
    },
  );
};
