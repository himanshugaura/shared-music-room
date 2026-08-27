import type { Server } from 'socket.io';
import { type QueueSongWithUser, addTrackToQueue } from '../../modules/queue/queue.service.js';
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
        const { song, autoStarted } = await addTrackToQueue(roomId, socket.user.id, track);

        io.to(roomId).emit('queue:song_added', { roomId, song, autoStarted });

        // First song added — tell all clients to start playing
        if (autoStarted) {
          io.to(roomId).emit('player:play', { roomId, at: Date.now() });
        }

        ack?.({ ok: true, data: song });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add song';
        ack?.({ ok: false, message });
      }
    },
  );
};
