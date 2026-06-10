import type { Server } from 'socket.io';
import { findRoomExistsById } from '../../repositories/room.repository.js';
import type { AckResponse, AuthenticatedSocket } from '../types.js';

type RoomJoinPayload = { roomId: string };
type RoomLeavePayload = { roomId: string };

export const registerRoomHandlers = (io: Server, socket: AuthenticatedSocket): void => {
  socket.on('room:join', async ({ roomId }: RoomJoinPayload, ack?: (res: AckResponse<{ roomId: string }>) => void) => {
    try {
      const room = await findRoomExistsById(roomId);

      if (!room) {
        ack?.({ ok: false, message: 'Room not found' });
        return;
      }

      await socket.join(roomId);

      socket.to(roomId).emit('room:member_joined', {
        userId: socket.user.id,
        roomId,
      });

      ack?.({ ok: true, data: { roomId } });
    } catch {
      ack?.({ ok: false, message: 'Failed to join room' });
    }
  });

  socket.on('room:leave', async ({ roomId }: RoomLeavePayload, ack?: (res: AckResponse) => void) => {
    try {
      await socket.leave(roomId);

      socket.to(roomId).emit('room:member_left', {
        userId: socket.user.id,
        roomId,
      });

      ack?.({ ok: true });
    } catch {
      ack?.({ ok: false, message: 'Failed to leave room' });
    }
  });
};
