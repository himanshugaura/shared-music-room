"use client";

import { useState, useEffect } from "react";
import { Rubik_Glitch } from "next/font/google";
import { useResendVerification, useLogout } from "@/hooks/useAuth";
import { useAuthStore } from "@/store";

const glitchFont = Rubik_Glitch({
  subsets: ["latin"],
  variable: "--font-glitch",
  weight: "400",
});

function MailIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#a3be8c"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function Spinner({ dark }: { dark?: boolean }) {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke={dark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.15)"} strokeWidth="3" />
      <path
        d="M12 2 A10 10 0 0 1 22 12"
        stroke={dark ? "#0f1117" : "#eceff4"}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function VerifyMailPage() {
  const user = useAuthStore((s) => s.user);
  const { mutate: resend, isPending } = useResendVerification();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function handleResend() {
    if (cooldown > 0 || isPending) return;
    setSuccessMsg(null);
    setErrorMsg(null);
    resend(undefined, {
      onSuccess: () => {
        setSuccessMsg("Email sent! Check your inbox.");
        setCooldown(60);
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to send verification email. Please try again.";
        setErrorMsg(msg);
      },
    });
  }

  const isButtonDisabled = isPending || cooldown > 0;

  return (
    <main
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden"
      style={{ background: "#0d1117" }}
    >
      {/* Ambient glow blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          style={{
            position: "absolute",
            top: "10%",
            left: "15%",
            width: "480px",
            height: "480px",
            background: "radial-gradient(ellipse at center, rgba(163,190,140,0.09) 0%, transparent 70%)",
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
            background: "radial-gradient(ellipse at center, rgba(143,188,187,0.07) 0%, transparent 70%)",
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

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4"
        style={{
          background: "rgba(22,27,34,0.75)",
          backdropFilter: "blur(24px) saturate(1.5)",
          WebkitBackdropFilter: "blur(24px) saturate(1.5)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px",
          padding: "44px 36px 40px",
          boxShadow:
            "0 0 0 1px rgba(163,190,140,0.04), 0 32px 64px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <span className={`${glitchFont.className} text-3xl tracking-wide`} style={{ color: "#eceff4" }}>
            Echo
          </span>
        </div>

        {/* Mail icon with glow ring */}
        <div className="flex justify-center mb-6">
          <div
            style={{
              width: "96px",
              height: "96px",
              borderRadius: "50%",
              background: "rgba(163,190,140,0.08)",
              border: "1px solid rgba(163,190,140,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 32px rgba(163,190,140,0.12)",
            }}
          >
            <MailIcon />
          </div>
        </div>

        {/* Title & body */}
        <h1
          className="text-2xl font-bold text-center mb-2 tracking-tight"
          style={{ color: "#eceff4" }}
        >
          Verify your email
        </h1>

        {user?.email && (
          <p className="text-center text-sm font-medium mb-3" style={{ color: "#a3be8c" }}>
            {user.email}
          </p>
        )}

        <p className="text-center text-sm leading-relaxed mb-8" style={{ color: "#6b7a8d" }}>
          We sent a verification link to your inbox. Click the link in the email to activate your account.
        </p>

        {/* Success message */}
        {successMsg && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm mb-4"
            style={{
              background: "rgba(163,190,140,0.1)",
              border: "1px solid rgba(163,190,140,0.25)",
              color: "#a3be8c",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {successMsg}
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm mb-4"
            style={{
              background: "rgba(191,97,106,0.1)",
              border: "1px solid rgba(191,97,106,0.25)",
              color: "#bf616a",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {errorMsg}
          </div>
        )}

        {/* Resend button */}
        <button
          id="resend-verification-btn"
          type="button"
          onClick={handleResend}
          disabled={isButtonDisabled}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60 disabled:opacity-60 disabled:cursor-not-allowed mb-3"
          style={{
            background: "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
            color: "#0f1117",
          }}
          onMouseEnter={(e) => {
            if (isButtonDisabled) return;
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.015)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(163,190,140,0.25)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
          }}
          onMouseDown={(e) => {
            if (isButtonDisabled) return;
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.975)";
          }}
          onMouseUp={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.015)";
          }}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner dark />
              Sending…
            </span>
          ) : cooldown > 0 ? (
            `Resend in ${cooldown}s`
          ) : (
            "Resend verification email"
          )}
        </button>

        {/* Sign out link */}
        <button
          id="signout-different-account"
          type="button"
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="w-full py-2.5 rounded-xl text-sm transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:underline disabled:opacity-60"
          style={{ color: "#6b7a8d", background: "transparent" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#d8dee9")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#6b7a8d")}
        >
          {isLoggingOut ? "Signing out…" : "Sign in with a different account"}
        </button>
      </div>
    </main>
  );
}
