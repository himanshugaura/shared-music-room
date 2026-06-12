"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { useGoogleAuth } from "@/hooks/useAuth";

export default function GoogleOAuthButton() {
  const { mutate: googleAuth, isPending } = useGoogleAuth();

  const login = useGoogleLogin({
    flow: "auth-code",

    onSuccess: ({ code }) => {
      googleAuth(code);
    },

    onError: () => {
      console.error("Google login failed");
    },
  });

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => login()}
      className="group flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:border-white/20 hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <GoogleIcon />

      <span>
        {isPending ? "Signing in..." : "Continue with Google"}
      </span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.24 36 24 36c-6.627 0-12-5.373-12-12S17.373 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.278 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819A11.958 11.958 0 0 1 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.278 4 24 4c-7.682 0-14.347 4.337-17.694 10.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.176 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.146 35.091 26.673 36 24 36c-5.219 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.045 12.045 0 0 1-4.084 5.571l.003-.002 6.19 5.238C36.971 38.47 44 33 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}