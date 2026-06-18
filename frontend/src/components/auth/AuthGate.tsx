"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMe } from "@/hooks/useAuth";
import { useAuthStore } from "@/store";
import { isGuestOnly, isProfileSetup, isProtected } from "@/lib/routes";

// ─── Loading spinner ──────────────────────────────────────────────────────────

function FullScreenLoader() {
  return (
    <div
      aria-label="Loading"
      role="status"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d1117",
        zIndex: 9999,
      }}
    >
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
        style={{ animation: "spin 0.8s linear infinite" }}
      >
        <circle
          cx="18"
          cy="18"
          r="15"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="3"
        />
        <path
          d="M18 3 A15 15 0 0 1 33 18"
          stroke="#a3be8c"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Auth Gate ────────────────────────────────────────────────────────────────

export function AuthGate({ children }: { children: ReactNode }) {
  // Trigger the /api/user/me call — populates Zustand store and sets isHydrated
  const { isSuccess, isError } = useMe();

  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Wait until the me-query has settled (either resolved or failed)
    if (!isHydrated) return;

    const loggedIn = !!user;
    const profileComplete = loggedIn && !!user!.username;

    // ── Guest-only routes (login / signup) ──────────────────────────────────
    if (isGuestOnly(pathname)) {
      if (loggedIn && profileComplete) {
        router.replace("/dashboard");
      } else if (loggedIn && !profileComplete) {
        router.replace("/profile");
      }
      return;
    }

    // ── Profile route (/profile) ─────────────────────────────────────────────
    // Requires login only. Users can visit whether their profile is complete or not.
    if (isProfileSetup(pathname)) {
      if (!loggedIn) {
        router.replace("/login");
      }
      return;
    }

    // ── Protected routes ────────────────────────────────────────────────────
    if (isProtected(pathname)) {
      if (!loggedIn) {
        router.replace("/login");
      } else if (!profileComplete) {
        router.replace("/profile");
      }
      return;
    }

    // ── Public routes (home "/") — always allowed ───────────────────────────
  }, [isHydrated, user, pathname, router]);

  // Show spinner until the initial auth check is complete
  if (!isHydrated) return <FullScreenLoader />;

  return <>{children}</>;
}
