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

export interface TokenPayload {
  userId: string;
}
