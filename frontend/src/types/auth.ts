export interface User {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  isVerified: boolean;
  avatarUrl: string | null;
  createdAt: string;
}
