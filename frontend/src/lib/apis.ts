const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL + "/api";

export const AuthEndpoints = {
  LOGIN_API: BASE_URL + "/auth/login",
  GOOGLE_AUTH_API: BASE_URL + "/auth/google",
  LOGOUT_API: BASE_URL + "/auth/logout",
  PROFILE_API: BASE_URL + "/user/me",
  SINGUP_API: BASE_URL + "/auth/register"
};
