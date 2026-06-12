"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Rubik_Glitch } from "next/font/google";
import { useVerifyEmail } from "@/hooks/useAuth";
import { useAuthStore } from "@/store";

const glitchFont = Rubik_Glitch({
  subsets: ["latin"],
  weight: "400",
});

// ── Icons ─────────────────────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin"
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="17" stroke="rgba(163,190,140,0.15)" strokeWidth="3" />
      <path
        d="M20 3 A17 17 0 0 1 37 20"
        stroke="#a3be8c"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckCircleIcon() {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#bf616a"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const user = useAuthStore((s) => s.user);
  const { mutate: verify, isPending, isSuccess, isError, error } = useVerifyEmail();

  // Fire once on mount — don't re-fire on re-renders
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !token) return;
    fired.current = true;
    verify(token);
  }, [token, verify]);

  // After a successful verification, auto-redirect after 2.5 s
  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(() => {
      // If no username yet → profile setup, else dashboard
      if (!user?.username) {
        router.replace("/profile");
      } else {
        router.replace("/dashboard");
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [isSuccess, user, router]);

  const errorMsg =
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? "This link may be expired or invalid. Please request a new one.";

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
        className="relative z-10 w-full max-w-md mx-4 text-center"
        style={{
          background: "rgba(22,27,34,0.75)",
          backdropFilter: "blur(24px) saturate(1.5)",
          WebkitBackdropFilter: "blur(24px) saturate(1.5)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "24px",
          padding: "48px 36px 44px",
          boxShadow:
            "0 0 0 1px rgba(163,190,140,0.04), 0 32px 64px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="focus-visible:outline-none" tabIndex={-1}>
            <span
              className={`${glitchFont.className} text-3xl tracking-wide`}
              style={{ color: "#eceff4" }}
            >
              Echo
            </span>
          </Link>
        </div>

        {/* ── No token ── */}
        {!token && (
          <>
            <div className="flex justify-center mb-6">
              <div
                style={{
                  width: "96px",
                  height: "96px",
                  borderRadius: "50%",
                  background: "rgba(191,97,106,0.08)",
                  border: "1px solid rgba(191,97,106,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <XCircleIcon />
              </div>
            </div>
            <h1
              className="text-2xl font-bold tracking-tight mb-2"
              style={{ color: "#eceff4" }}
            >
              Invalid link
            </h1>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "#6b7a8d" }}>
              This verification link is missing a token. Please use the link from your email.
            </p>
            <Link
              href="/verify-mail"
              className="inline-block w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.015] active:scale-[0.975] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60"
              style={{
                background: "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
                color: "#0f1117",
              }}
            >
              Resend verification email
            </Link>
          </>
        )}

        {/* ── Verifying (in-flight) ── */}
        {token && isPending && (
          <>
            <div className="flex justify-center mb-6">
              <div
                style={{
                  width: "96px",
                  height: "96px",
                  borderRadius: "50%",
                  background: "rgba(163,190,140,0.06)",
                  border: "1px solid rgba(163,190,140,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SpinnerIcon />
              </div>
            </div>
            <h1
              className="text-2xl font-bold tracking-tight mb-2"
              style={{ color: "#eceff4" }}
            >
              Verifying your email
            </h1>
            <p className="text-sm" style={{ color: "#6b7a8d" }}>
              Just a moment…
            </p>
          </>
        )}

        {/* ── Success ── */}
        {isSuccess && (
          <>
            <div className="flex justify-center mb-6">
              <div
                style={{
                  width: "96px",
                  height: "96px",
                  borderRadius: "50%",
                  background: "rgba(163,190,140,0.08)",
                  border: "1px solid rgba(163,190,140,0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 32px rgba(163,190,140,0.14)",
                }}
              >
                <CheckCircleIcon />
              </div>
            </div>
            <h1
              className="text-2xl font-bold tracking-tight mb-2"
              style={{ color: "#eceff4" }}
            >
              Email verified!
            </h1>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "#6b7a8d" }}>
              Your account is now active. You&apos;ll be redirected in a moment…
            </p>
            <Link
              href={user?.username ? "/dashboard" : "/profile"}
              className="inline-block w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.015] active:scale-[0.975] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60"
              style={{
                background: "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
                color: "#0f1117",
              }}
            >
              {user?.username ? "Go to Dashboard" : "Set up your profile"}
            </Link>
          </>
        )}

        {/* ── Error ── */}
        {isError && (
          <>
            <div className="flex justify-center mb-6">
              <div
                style={{
                  width: "96px",
                  height: "96px",
                  borderRadius: "50%",
                  background: "rgba(191,97,106,0.08)",
                  border: "1px solid rgba(191,97,106,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <XCircleIcon />
              </div>
            </div>
            <h1
              className="text-2xl font-bold tracking-tight mb-2"
              style={{ color: "#eceff4" }}
            >
              Verification failed
            </h1>
            <p
              className="text-sm leading-relaxed mb-8"
              style={{ color: "#6b7a8d" }}
            >
              {errorMsg}
            </p>
            <Link
              href="/verify-mail"
              className="inline-block w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-[1.015] active:scale-[0.975] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60"
              style={{
                background: "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
                color: "#0f1117",
              }}
            >
              Resend verification email
            </Link>

            <Link
              href="/login"
              className="block mt-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:underline"
              style={{ color: "#6b7a8d" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "#d8dee9")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "#6b7a8d")
              }
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
