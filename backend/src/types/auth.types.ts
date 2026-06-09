export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  isVerified: boolean;
  avatarUrl: string | null;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RegisterResponse {
  id: string;
  email: string;
}

export interface AccessTokenPayload {
  userId: string;
}

export interface RefreshTokenPayload {
  userId: string;
}

export interface RegisterBody {
  email: string;
  password: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface GoogleAuthBody {
  credential: string;
}

export interface AuthPayload {
  id: string;
  email: string;
  isVerified: boolean;
}