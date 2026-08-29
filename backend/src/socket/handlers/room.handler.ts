import type { Server } from 'socket.io';
import { findRoomExistsById } from '../../modules/room/room.service.js';
import { addRoomMember, getOnlineUsers, removeRoomMember } from '../../redis/presence.js';
import { getPlayerState } from '../../redis/player.js';
import { getSkipVotes } from '../../redis/skipVotes.js';
import type { AckResponse, AuthenticatedSocket, OnlineUser } from '../types.js';

type RoomJoinPayload = { roomId: string };
type RoomLeavePayload = { roomId: string };

export const registerRoomHandlers = (io: Server, socket: AuthenticatedSocket): void => {
  const isSocketLive = (socketId: string) => io.sockets.sockets.has(socketId);

  const syncSkipVotesThreshold = async (roomId: string, onlineCount: number) => {
    try {
      const state = await getPlayerState(roomId);
      if (state?.currentQueueSongId) {
        const skipVotes = await getSkipVotes(roomId, state.currentQueueSongId);
        const requiredVotes = Math.floor(Math.max(1, onlineCount) / 2) + 1;
        io.to(roomId).emit('player:skip_votes_updated', {
          roomId,
          currentVotes: skipVotes.currentVotes,
          requiredVotes,
          userIds: skipVotes.userIds,
        });
      }
    } catch {}
  };

  socket.on(
    'room:join',
    async (
      { roomId }: RoomJoinPayload,
      ack?: (res: AckResponse<{ roomId: string; onlineUsers: OnlineUser[] }>) => void,
    ) => {
      try {
        const room = await findRoomExistsById(roomId);

        if (!room) {
          ack?.({ ok: false, message: 'Room not found' });
          return;
        }

        const onlineUser: OnlineUser = {
          id: socket.user.id,
          name: socket.user.name ?? null,
          username: socket.user.username ?? null,
          avatarUrl: socket.user.avatarUrl ?? null,
        };

        const { isFirstSocket, onlineUsers } = await addRoomMember(
          roomId,
          socket.id,
          onlineUser,
          isSocketLive,
        );

        await socket.join(roomId);

        io.to(roomId).emit('room:online_users_updated', {
          roomId,
          onlineUsers,
        });

        syncSkipVotesThreshold(roomId, onlineUsers.length);

        if (isFirstSocket) {
          socket.to(roomId).emit('room:member_joined', {
            user: onlineUser,
            roomId,
            onlineUsers,
          });
        }

        ack?.({ ok: true, data: { roomId, onlineUsers } });
      } catch {
        ack?.({ ok: false, message: 'Failed to join room' });
      }
    },
  );

  socket.on(
    'room:leave',
    async ({ roomId }: RoomLeavePayload, ack?: (res: AckResponse) => void) => {
      try {
        const { isLastSocket, remainingUsers } = await removeRoomMember(
          roomId,
          socket.id,
          socket.user.id,
          isSocketLive,
        );

        await socket.leave(roomId);

        io.to(roomId).emit('room:online_users_updated', {
          roomId,
          onlineUsers: remainingUsers,
        });

        syncSkipVotesThreshold(roomId, remainingUsers.length);

        if (isLastSocket) {
          socket.to(roomId).emit('room:member_left', {
            userId: socket.user.id,
            roomId,
            onlineUsers: remainingUsers,
          });
        }

        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, message: 'Failed to leave room' });
      }
    },
  );

  socket.on(
    'room:get_online_users',
    async ({ roomId }: { roomId: string }, ack?: (res: AckResponse<OnlineUser[]>) => void) => {
      try {
        const users = await getOnlineUsers(roomId, isSocketLive);
        ack?.({ ok: true, data: users });
      } catch {
        ack?.({ ok: false, message: 'Failed to fetch online users' });
      }
    },
  );

  socket.on('disconnecting', async () => {
    try {
      const rooms = Array.from(socket.rooms);
      for (const roomId of rooms) {
        if (roomId === socket.id) continue;

        const { isLastSocket, remainingUsers } = await removeRoomMember(
          roomId,
          socket.id,
          socket.user.id,
          isSocketLive,
        );

        io.to(roomId).emit('room:online_users_updated', {
          roomId,
          onlineUsers: remainingUsers,
        });

        syncSkipVotesThreshold(roomId, remainingUsers.length);

        if (isLastSocket) {
          socket.to(roomId).emit('room:member_left', {
            userId: socket.user.id,
            roomId,
            onlineUsers: remainingUsers,
          });
        }
      }
    } catch {}
  });
};
