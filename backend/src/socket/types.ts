import type { Socket } from 'socket.io';

export type SocketUser = {
  id: string;
  email: string | null;
};

export type AuthenticatedSocket = Socket & {
  user: SocketUser;
};

export type AckResponse<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };
