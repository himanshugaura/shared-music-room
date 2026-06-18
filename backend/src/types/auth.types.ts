export interface AuthUser {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RegisterResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface AccessTokenPayload {
  userId: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
}

export interface RegisterBody {
  username: string;
  name: string;
  password: string;
}

export interface LoginBody {
  username: string;
  password: string;
}

export interface GoogleAuthBody {
  code: string;
}