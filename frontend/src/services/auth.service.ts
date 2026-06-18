import { api } from "@/api/axios";
import { AuthEndpoints } from "@/lib/apis";

export const login = async (body: { username: string; password: string }) => {
  const { data } = await api.post(AuthEndpoints.LOGIN_API, body);
  return data.data;
};

export const googleAuth = async (code: string) => {
  const { data } = await api.post(AuthEndpoints.GOOGLE_AUTH_API, { code });
  return data.data;
};

export const register = async (body: {
  username: string;
  name: string;
  password: string;
}) => {
  const { data } = await api.post(AuthEndpoints.SINGUP_API, body);
  return data.data;
};

export const logout = async () => {
  await api.post(AuthEndpoints.LOGOUT_API);
};

export const getMe = async () => {
  const { data } = await api.get(AuthEndpoints.PROFILE_API);
  return data.data;
};