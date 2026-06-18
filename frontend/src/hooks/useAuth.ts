import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { login, logout, getMe, googleAuth, register } from "@/services/auth.service";
import { api } from "@/api/axios";
import { toast } from "sonner";

const PROFILE_KEY = ["auth", "me"] as const;

function extractMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  );
}

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
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      login({ username, password }),
    onSuccess: (user) => {
      setUser(user);
      qc.setQueryData(PROFILE_KEY, user);
    },
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Something went wrong. Please try again."));
    },
  });
};

export const useRegister = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ username, name, password }: { username: string; name: string; password: string }) =>
      register({ username, name, password }),
    onSuccess: (user) => {
      setUser(user);
      qc.setQueryData(PROFILE_KEY, user);
      toast.success("Account created! Welcome to Echo 🎵");
    },
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Something went wrong. Please try again."));
    },
  });
};

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
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Google sign-in failed. Please try again."));
    },
  });
};

export const useLogout = () => {
  const clearUser = useAuthStore((s) => s.clearUser);
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      toast.success("Signed out successfully.");
    },
    onError: () => {
      toast.error("Sign-out failed. Please try again.");
    },
    onSettled: () => {
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
      toast.success("Profile saved successfully!");
    },
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Failed to save profile. Please try again."));
    },
  });
};

/** Check if a username is available. Returns { available, message }. Never throws. */
export async function checkUsernameAvailable(
  username: string
): Promise<{ available: boolean; message: string }> {
  try {
    await api.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/user/check-username`, { username });
    return { available: true, message: "" };
  } catch (err: unknown) {
    const msg =
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      "Username is unavailable";
    return { available: false, message: msg };
  }
}
