import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { login, logout, getMe, googleAuth, register, verifyEmail } from "@/services/auth.service";
import { api } from "@/api/axios";

const PROFILE_KEY = ["auth", "me"] as const;

export const useMe = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);

  const query = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: async () => {
      const user = await getMe();
      setUser(user);
      return user;
    },
    retry: false,
    staleTime: Infinity,
  });

  // Fire setHydrated once the query settles — regardless of success or failure
  useEffect(() => {
    if (query.isSuccess || query.isError) {
      setHydrated();
    }
  }, [query.isSuccess, query.isError, setHydrated]);

  return query;
};

export const useLogin = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login({ email, password }),
    onSuccess: (user) => {
      setUser(user);
      qc.setQueryData(PROFILE_KEY, user);
    },
  });
};

export const useRegister = () =>
  useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      register({ email, password }),
  });

export const useGoogleAuth = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => googleAuth(code),
    onSuccess: (user) => {
      setUser(user);
      qc.setQueryData(PROFILE_KEY, user);
      window.location.href = "/dashboard";
    },
    onError: (error) => {
      console.error("Google authentication failed:", error);
    },
  });
};

export const useLogout = () => {
  const clearUser = useAuthStore((s) => s.clearUser);
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      // Always clear state locally, even if the server call fails
      clearUser();
      qc.removeQueries({ queryKey: PROFILE_KEY });
      router.replace("/login");
    },
  });
};

export const useUpdateProfile = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) =>
      api.put(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user/me`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((res) => res.data.data),
    onSuccess: (user) => {
      setUser(user);
      qc.setQueryData(["auth", "me"], user);
    },
  });
};

export const useResendVerification = () => {
  return useMutation({
    mutationFn: () =>
      api.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/send-verification`).then((r) => r.data),
  });
};

export const useVerifyEmail = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => verifyEmail(token),
    onSuccess: async () => {
      // Re-fetch /user/me so isVerified flips to true in the store
      try {
        const { data } = await api.get(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/user/me`
        );
        const freshUser = data.data;
        setUser(freshUser);
        qc.setQueryData(["auth", "me"], freshUser);
      } catch {
        // If re-fetch fails, invalidate so it refetches on next mount
        qc.invalidateQueries({ queryKey: ["auth", "me"] });
      }
    },
  });
};
