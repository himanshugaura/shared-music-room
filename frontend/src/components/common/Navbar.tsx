"use client";

import Link from "next/link";
import { Rubik_Glitch } from "next/font/google";
import { useAuthStore } from "@/store";
import { useLogout } from "@/hooks/useAuth";

const glitchFont = Rubik_Glitch({
  subsets: ["latin"],
  variable: "--font-glitch",
  weight: "400",
});

function AvatarBadge({
  avatarUrl,
  name,
  username,
  email,
}: {
  avatarUrl: string | null;
  name: string | null;
  username: string | null;
  email: string;
}) {
  const initials = (name || username || email || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          objectFit: "cover",
          border: "1.5px solid rgba(163,190,140,0.4)",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        background: "rgba(163,190,140,0.15)",
        border: "1.5px solid rgba(163,190,140,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "11px",
        fontWeight: 700,
        color: "#a3be8c",
        letterSpacing: "0.04em",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials}
    </span>
  );
}

export default function Navbar() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex justify-center px-6 pt-5">
      <nav
        className="
          w-full max-w-5xl
          flex items-center justify-between
          px-5 py-3
          glass
          rounded-2xl
          border border-white/[0.07]
        "
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="flex items-center gap-2 focus-visible:outline-none"
        >
          <span className={`${glitchFont.className} text-2xl`}>Echo</span>
        </Link>

        {/* Auth controls — hidden until hydrated to avoid flash */}
        {isHydrated && (
          <div className="flex items-center gap-2">
            {user ? (
              /* ── Logged-in state ── */
              <>
                <Link
                  href="/profile"
                  id="nav-profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors duration-150 focus-visible:outline-none"
                  style={{ color: "#d8dee9" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.background =
                      "rgba(255,255,255,0.05)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLAnchorElement).style.background =
                      "transparent")
                  }
                  aria-label="Your profile"
                >
                  <AvatarBadge
                    avatarUrl={user.avatarUrl}
                    name={user.name}
                    username={user.username}
                    email={user.email}
                  />
                  <span className="text-sm font-medium hidden sm:block" style={{ color: "#d8dee9" }}>
                    {user.username ? `@${user.username}` : (user.name ?? user.email)}
                  </span>
                </Link>

                <Link
                  href="/dashboard"
                  id="nav-dashboard"
                  className="
                    text-[#0f1117] bg-[#a3be8c] hover:bg-[#8faa78]
                    text-sm font-semibold
                    px-4 py-2 rounded-full
                    transition-all duration-200
                    hover:scale-[1.03] active:scale-[0.97]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60
                  "
                >
                  Dashboard
                </Link>

                <button
                  id="nav-logout"
                  type="button"
                  onClick={() => logout()}
                  disabled={isLoggingOut}
                  className="
                    text-sm font-medium
                    px-4 py-2 rounded-full
                    transition-colors duration-150
                    focus-visible:outline-none focus-visible:underline
                    disabled:opacity-50 disabled:cursor-not-allowed
                    cursor-pointer
                  "
                  style={{ color: "#6b7a8d" }}
                  onMouseEnter={(e) =>
                    !isLoggingOut &&
                    ((e.currentTarget as HTMLButtonElement).style.color =
                      "#bf616a")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color =
                      "#6b7a8d")
                  }
                >
                  {isLoggingOut ? "Signing out…" : "Log out"}
                </button>
              </>
            ) : (
              /* ── Guest state ── */
              <>
                <Link
                  href="/login"
                  id="nav-login"
                  className="
                    text-[#6b7a8d] hover:text-[#d8dee9]
                    text-sm font-medium
                    px-4 py-2 rounded-full
                    transition-colors duration-150
                    focus-visible:outline-none focus-visible:underline
                  "
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  id="nav-signup"
                  className="
                    text-[#0f1117] bg-[#a3be8c] hover:bg-[#8faa78]
                    text-sm font-semibold
                    px-5 py-2 rounded-full
                    transition-all duration-200
                    hover:scale-[1.03] active:scale-[0.97]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60
                  "
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}
