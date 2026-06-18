"use client";

import { useState, useRef, useEffect } from "react";
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
  size = 34,
}: {
  avatarUrl: string | null;
  name: string | null;
  username: string | null;
  email?: string | null;
  size?: number;
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
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: "1.5px solid rgba(163,190,140,0.4)",
          flexShrink: 0,
          display: "block",
        }}
      />
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(163,190,140,0.15)",
        border: "1.5px solid rgba(163,190,140,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.32),
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

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [dropdownOpen]);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex justify-center px-4 sm:px-6 pt-4 sm:pt-5">
      <nav
        className="w-full max-w-5xl flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 glass rounded-2xl border border-white/[0.07]"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 focus-visible:outline-none">
          <span className={`${glitchFont.className} text-xl sm:text-2xl`}>Echo</span>
        </Link>

        {/* Right side */}
        {isHydrated && (
          <div className="flex items-center gap-2">
            {user ? (
              /* ── Logged-in ── */
              <>
                {/* Dashboard button */}
                <Link
                  href="/dashboard"
                  id="nav-dashboard"
                  className="text-[#0f1117] bg-[#a3be8c] hover:bg-[#8faa78] text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60"
                >
                  Dashboard
                </Link>

                {/* Avatar + dropdown */}
                <div ref={dropdownRef} style={{ position: "relative" }}>
                  <button
                    id="nav-avatar-btn"
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={dropdownOpen}
                    aria-label="Account menu"
                    onClick={() => setDropdownOpen((v) => !v)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: dropdownOpen ? "rgba(255,255,255,0.07)" : "transparent",
                      border: "none",
                      borderRadius: "9999px",
                      padding: "3px 8px 3px 3px",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!dropdownOpen)
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      if (!dropdownOpen)
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }}
                  >
                    <AvatarBadge
                      avatarUrl={user.avatarUrl}
                      name={user.name}
                      username={user.username}
                      email={user.email ?? undefined}
                    />
                    {/* Chevron */}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#6b7a8d"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transition: "transform 0.2s",
                        transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {dropdownOpen && (
                    <div
                      role="menu"
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        minWidth: "180px",
                        background: "rgba(22,27,34,0.98)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "14px",
                        padding: "6px",
                        boxShadow: "0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
                        zIndex: 100,
                        animation: "dropdownFadeIn 0.15s ease",
                      }}
                    >
                      {/* User info header */}
                      <div
                        style={{
                          padding: "8px 12px 10px",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                          marginBottom: "4px",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#eceff4" }}>
                          {user.name || user.username || "User"}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#6b7a8d", wordBreak: "break-all" }}>
                          {user.email ?? user.username ?? ""}
                        </p>
                      </div>

                      {/* Profile option */}
                      <Link
                        href="/profile"
                        id="dropdown-profile"
                        role="menuitem"
                        onClick={() => setDropdownOpen(false)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          color: "#d8dee9",
                          textDecoration: "none",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        Profile
                      </Link>

                      {/* Logout option */}
                      <button
                        id="dropdown-logout"
                        type="button"
                        role="menuitem"
                        disabled={isLoggingOut}
                        onClick={() => { setDropdownOpen(false); logout(); }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          width: "100%",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          border: "none",
                          background: "transparent",
                          fontSize: "13px",
                          color: "#bf616a",
                          cursor: isLoggingOut ? "not-allowed" : "pointer",
                          opacity: isLoggingOut ? 0.6 : 1,
                          transition: "background 0.12s",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                          if (!isLoggingOut)
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(191,97,106,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        {isLoggingOut ? "Signing out…" : "Log out"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ── Guest ── */
              <>
                <Link
                  href="/login"
                  id="nav-login"
                  className="text-[#6b7a8d] hover:text-[#d8dee9] text-xs sm:text-sm font-medium px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-colors duration-150 focus-visible:outline-none"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  id="nav-signup"
                  className="text-[#0f1117] bg-[#a3be8c] hover:bg-[#8faa78] text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        )}
      </nav>

      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
