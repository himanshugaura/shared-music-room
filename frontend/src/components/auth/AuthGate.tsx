"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMe } from "@/hooks/useAuth";
import { useAuthStore } from "@/store";
import { isGuestOnly, isProfileSetup, isProtected } from "@/lib/routes";

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

export function AuthGate({ children }: { children: ReactNode }) {
  const { isSuccess, isError } = useMe();

  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isHydrated) return;

    const loggedIn = !!user;
    const profileComplete = loggedIn && !!user!.username;

    if (isGuestOnly(pathname)) {
      if (loggedIn && profileComplete) {
        router.replace("/dashboard");
      } else if (loggedIn && !profileComplete) {
        router.replace("/profile");
      }
      return;
    }

    if (isProfileSetup(pathname)) {
      if (!loggedIn) {
        router.replace("/login");
      }
      return;
    }

    if (isProtected(pathname)) {
      if (!loggedIn) {
        router.replace("/login");
      } else if (!profileComplete) {
        router.replace("/profile");
      }
      return;
    }
  }, [isHydrated, user, pathname, router]);

  if (!isHydrated) return <FullScreenLoader />;

  return <>{children}</>;
}
