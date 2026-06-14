import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { login, logout, getMe, googleAuth, register, verifyEmail } from "@/services/auth.service";
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
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Something went wrong. Please try again."));
    },
  });
};

export const useRegister = () =>
  useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      register({ email, password }),
    onSuccess: () => {
      toast.success("Account created! Check your inbox to verify your email.");
    },
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Something went wrong. Please try again."));
    },
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
      toast.success("Profile saved successfully!");
    },
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Failed to save profile. Please try again."));
    },
  });
};

export const useResendVerification = () => {
  return useMutation({
    mutationFn: () =>
      api.post(`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/send-verification`).then((r) => r.data),
    onSuccess: () => {
      toast.success("Verification email sent! Check your inbox.");
    },
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Failed to resend verification email."));
    },
  });
};

export const useVerifyEmail = () => {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => verifyEmail(token),
    onSuccess: async () => {
      toast.success("Email verified! Welcome to Echo 🎵");
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
    onError: (err: unknown) => {
      toast.error(extractMessage(err, "Email verification failed. The link may have expired."));
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
