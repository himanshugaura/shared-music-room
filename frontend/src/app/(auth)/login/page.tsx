"use client";

import Link from "next/link";
import { Rubik_Glitch } from "next/font/google";
import { useState } from "react";
import { useRouter } from "next/navigation";
import GoogleOAuthButton from "@/components/auth/GoogleLoginButton";
import { useLogin } from "@/hooks/useAuth";

const glitchFont = Rubik_Glitch({
  subsets: ["latin"],
  variable: "--font-glitch",
  weight: "400",
});

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p
      className="flex items-center gap-1.5 text-xs mt-1"
      role="alert"
      aria-live="polite"
      style={{ color: "#bf616a" }}
    >
      <ErrorIcon />
      {message}
    </p>
  );
}

function validateEmail(value: string): string {
  if (!value.trim()) return "Email is required";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value.trim())) return "Please enter a valid email address";
  return "";
}

function validatePassword(value: string): string {
  if (!value) return "Password is required";
  return "";
}

export default function LoginPage() {
  const router = useRouter();
  const { mutate: loginMutate, isPending } = useLogin();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Error state — only shown after blur or submit
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  const emailError = touched.email ? validateEmail(email) : "";
  const passwordError = touched.password ? validatePassword(password) : "";

  function handleBlur(field: "email" | "password") {
    setTouched(prev => ({ ...prev, [field]: true }));
    setFocused(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Touch all fields on submit
    setTouched({ email: true, password: true });

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    setErrors({ email: eErr, password: pErr });

    if (eErr || pErr) return;

    setServerError(null);
    loginMutate(
      { email: email.trim(), password },
      {
        onSuccess: (user) => {
          if (!user.isVerified) {
            router.replace("/verify-mail");
          } else if (!user.username) {
            router.replace("/profile");
          } else {
            router.replace("/dashboard");
          }
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            ?? "Something went wrong. Please try again.";
          setServerError(msg);
        },
      }
    );
  }

  function getBorderStyle(field: "email" | "password") {
    const hasError = field === "email" ? emailError : passwordError;
    const isFocused = focused === field;
    if (hasError) {
      return {
        border: "1px solid rgba(191,97,106,0.6)",
        boxShadow: isFocused ? "0 0 0 3px rgba(191,97,106,0.1)" : "0 0 0 3px rgba(191,97,106,0.06)",
      };
    }
    return {
      border: isFocused ? "1px solid rgba(163,190,140,0.5)" : "1px solid rgba(255,255,255,0.08)",
      boxShadow: isFocused ? "0 0 0 3px rgba(163,190,140,0.08)" : "none",
    };
  }

  return (
    <main className="relative min-h-screen w-full bg-[#0d1117] flex items-center justify-center overflow-hidden">

      {/* Ambient glow blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "15%",
            width: "480px",
            height: "480px",
            background:
              "radial-gradient(ellipse at center, rgba(163,190,140,0.09) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "5%",
            right: "10%",
            width: "380px",
            height: "380px",
            background:
              "radial-gradient(ellipse at center, rgba(143,188,187,0.07) 0%, transparent 70%)",
            filter: "blur(50px)",
          }}
        />
        {/* Subtle grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Back to home */}
      <Link
        href="/"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-[#6b7a8d] hover:text-[#d8dee9] text-sm transition-colors duration-150 focus-visible:outline-none"
        id="back-to-home"
        aria-label="Back to home"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </Link>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4"
        style={{
          background: "rgba(22,27,34,0.75)",
          backdropFilter: "blur(24px) saturate(1.5)",
          WebkitBackdropFilter: "blur(24px) saturate(1.5)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px",
          padding: "40px 36px 36px",
          boxShadow:
            "0 0 0 1px rgba(163,190,140,0.04), 0 32px 64px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 mb-8">
          <Link href="/" className="focus-visible:outline-none" tabIndex={-1} aria-hidden="true">
            <span className={`${glitchFont.className} text-3xl text-[#eceff4] tracking-wide`}>
              Echo
            </span>
          </Link>
        </div>

        <h1 className="text-[#eceff4] text-2xl font-bold text-center mb-1 tracking-tight">
          Welcome back
        </h1>
        <p className="text-[#6b7a8d] text-sm text-center mb-7">
          Sign in to your Echo account
        </p>

        <GoogleOAuthButton />

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/[0.07]" />
          <span className="text-[#6b7a8d] text-xs">or</span>
          <div className="flex-1 h-px bg-white/[0.07]" />
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="login-email"
              className="text-[#d8dee9] text-xs font-medium tracking-wide"
            >
              Email
            </label>
            <div
              className="relative rounded-xl transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                ...getBorderStyle("email"),
              }}
            >
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (touched.email) setErrors(prev => ({ ...prev, email: validateEmail(e.target.value) }));
                }}
                onFocus={() => setFocused("email")}
                onBlur={() => handleBlur("email")}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "login-email-error" : undefined}
                className="w-full bg-transparent px-4 py-3 text-[#eceff4] text-sm placeholder-[#6b7a8d]/60 focus:outline-none rounded-xl"
              />
            </div>
            {emailError && (
              <span id="login-email-error">
                <FieldError message={emailError} />
              </span>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="text-[#d8dee9] text-xs font-medium tracking-wide"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                id="forgot-password-link"
                className="text-[#a3be8c] hover:text-[#8faa78] text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div
              className="relative rounded-xl transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                ...getBorderStyle("password"),
              }}
            >
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (touched.password) setErrors(prev => ({ ...prev, password: validatePassword(e.target.value) }));
                }}
                onFocus={() => setFocused("password")}
                onBlur={() => handleBlur("password")}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "login-password-error" : undefined}
                className="w-full bg-transparent px-4 py-3 pr-12 text-[#eceff4] text-sm placeholder-[#6b7a8d]/60 focus:outline-none rounded-xl"
              />
              <button
                type="button"
                id="toggle-password-visibility"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7a8d] hover:text-[#d8dee9] transition-colors duration-150 cursor-pointer focus-visible:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {passwordError && (
              <span id="login-password-error">
                <FieldError message={passwordError} />
              </span>
            )}
          </div>

          {/* Server-level error */}
          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(191,97,106,0.1)",
                border: "1px solid rgba(191,97,106,0.25)",
                color: "#bf616a",
              }}
            >
              <ErrorIcon />
              <span>{serverError}</span>
            </div>
          )}

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-xl text-[#0f1117] text-sm font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60 mt-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
            style={{
              background: "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
            }}
            onMouseEnter={e => {
              if (isPending) return;
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.015)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(163,190,140,0.25)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
            onMouseDown={e => {
              if (isPending) return;
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.975)";
            }}
            onMouseUp={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.015)";
            }}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.2)" strokeWidth="3" />
                  <path d="M12 2 A10 10 0 0 1 22 12" stroke="#0f1117" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Signing in…
              </span>
            ) : "Sign in"}
          </button>
        </form>

        {/* Sign up link */}
        <p className="text-center text-[#6b7a8d] text-sm mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            id="goto-signup"
            className="text-[#a3be8c] hover:text-[#8faa78] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
