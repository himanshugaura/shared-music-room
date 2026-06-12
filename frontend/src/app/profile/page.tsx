"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Rubik_Glitch } from "next/font/google";
import { useMe, useUpdateProfile, useLogout } from "@/hooks/useAuth";
import { useAuthStore } from "@/store";

const glitchFont = Rubik_Glitch({
  subsets: ["latin"],
  variable: "--font-glitch",
  weight: "400",
});

function AvatarUpload({
  avatarUrl,
  name,
  email,
  preview,
  onClick,
}: {
  avatarUrl: string | null;
  name: string | null;
  email: string;
  preview: string | null;
  onClick: () => void;
}) {
  const initials = (name || email || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const src = preview || avatarUrl;

  return (
    <button
      type="button"
      id="avatar-upload-btn"
      onClick={onClick}
      aria-label="Change profile photo"
      style={{
        position: "relative",
        width: "96px",
        height: "96px",
        borderRadius: "50%",
        border: "2px solid rgba(163,190,140,0.35)",
        background: src ? "transparent" : "rgba(163,190,140,0.12)",
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "border-color 0.2s",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(163,190,140,0.7)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(163,190,140,0.35)";
      }}
    >
      {src ? (
        <img
          src={src}
          alt="Profile avatar"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "#a3be8c",
            letterSpacing: "0.02em",
            userSelect: "none",
          }}
        >
          {initials}
        </span>
      )}

      {/* Hover overlay */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0,
          transition: "opacity 0.2s",
          borderRadius: "50%",
          color: "#eceff4",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          flexDirection: "column",
          gap: "4px",
        }}
        className="avatar-overlay"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span>Change</span>
      </span>
      <style>{`
        #avatar-upload-btn:hover .avatar-overlay { opacity: 1 !important; }
      `}</style>
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.2)" strokeWidth="3" />
      <path d="M12 2 A10 10 0 0 1 22 12" stroke="#0f1117" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function ProfilePage() {
  useMe(); // Ensure user is loaded

  const user = useAuthStore((s) => s.user);
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill inputs from current user data
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setUsername(user.username ?? "");
    }
  }, [user]);

  const profileComplete = !!(user?.name || user?.username);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const formData = new FormData();
    if (name.trim()) formData.append("name", name.trim());
    if (username.trim()) formData.append("username", username.trim());
    if (avatarFile) formData.append("avatar", avatarFile);

    updateProfile(formData, {
      onSuccess: () => {
        setSuccessMsg("Profile saved successfully!");
        setAvatarFile(null);
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to save profile. Please try again.";
        setErrorMsg(msg);
      },
    });
  }

  function getInputBorderStyle(field: string) {
    const isFocused = focused === field;
    return {
      border: isFocused ? "1px solid rgba(163,190,140,0.5)" : "1px solid rgba(255,255,255,0.08)",
      boxShadow: isFocused ? "0 0 0 3px rgba(163,190,140,0.08)" : "none",
    };
  }

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

      {/* Back link — shown only if profile is complete */}
      {profileComplete && (
        <Link
          href="/dashboard"
          id="back-to-dashboard"
          className="absolute top-6 left-6 z-20 flex items-center gap-2 text-sm transition-colors duration-150 focus-visible:outline-none"
          style={{ color: "#6b7a8d" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#d8dee9")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#6b7a8d")}
          aria-label="Back to dashboard"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Dashboard
        </Link>
      )}

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
        <div className="flex flex-col items-center gap-1 mb-6">
          <Link href="/" className="focus-visible:outline-none" tabIndex={-1} aria-hidden="true">
            <span className={`${glitchFont.className} text-3xl text-[#eceff4] tracking-wide`}>
              Echo
            </span>
          </Link>
        </div>

        <h1 className="text-[#eceff4] text-2xl font-bold text-center mb-1 tracking-tight">
          Set up your profile
        </h1>
        <p className="text-[#6b7a8d] text-sm text-center mb-6">
          {profileComplete ? "Edit your profile information" : "Complete your profile to get started"}
        </p>

        {/* Incomplete profile notice */}
        {!profileComplete && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm mb-5"
            style={{
              background: "rgba(163,190,140,0.08)",
              border: "1px solid rgba(163,190,140,0.2)",
              color: "#a3be8c",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Complete your profile to get started</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <AvatarUpload
              avatarUrl={user?.avatarUrl ?? null}
              name={user?.name ?? null}
              email={user?.email ?? ""}
              preview={avatarPreview}
              onClick={() => fileInputRef.current?.click()}
            />
            <p className="text-xs" style={{ color: "#6b7a8d" }}>
              Click to upload a photo
            </p>
            <input
              ref={fileInputRef}
              id="avatar-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Upload profile photo"
            />
          </div>

          {/* Email (read-only) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-email" className="text-xs font-medium tracking-wide" style={{ color: "#d8dee9" }}>
              Email
            </label>
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#6b7a8d",
                userSelect: "all",
              }}
              id="profile-email"
              aria-label="Email address (read-only)"
            >
              {user?.email ?? "—"}
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-name" className="text-xs font-medium tracking-wide" style={{ color: "#d8dee9" }}>
              Name
            </label>
            <div
              className="relative rounded-xl transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                ...getInputBorderStyle("name"),
              }}
            >
              <input
                id="profile-name"
                type="text"
                autoComplete="name"
                placeholder="Your display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused(null)}
                className="w-full bg-transparent px-4 py-3 text-sm focus:outline-none rounded-xl"
                style={{ color: "#eceff4" }}
              />
            </div>
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="profile-username" className="text-xs font-medium tracking-wide" style={{ color: "#d8dee9" }}>
              Username
            </label>
            <div
              className="relative flex items-center rounded-xl transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                ...getInputBorderStyle("username"),
              }}
            >
              <span
                className="pl-4 pr-1 text-sm select-none"
                style={{ color: "#6b7a8d" }}
                aria-hidden="true"
              >
                @
              </span>
              <input
                id="profile-username"
                type="text"
                autoComplete="username"
                placeholder="yourhandle"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                onFocus={() => setFocused("username")}
                onBlur={() => setFocused(null)}
                className="flex-1 bg-transparent pr-4 py-3 text-sm focus:outline-none rounded-r-xl"
                style={{ color: "#eceff4" }}
              />
            </div>
          </div>

          {/* Success banner */}
          {successMsg && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(163,190,140,0.1)",
                border: "1px solid rgba(163,190,140,0.25)",
                color: "#a3be8c",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {successMsg}
            </div>
          )}

          {/* Error banner */}
          {errorMsg && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(191,97,106,0.1)",
                border: "1px solid rgba(191,97,106,0.25)",
                color: "#bf616a",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {errorMsg}
            </div>
          )}

          {/* Save button */}
          <button
            id="profile-save-btn"
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60 mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
              color: "#0f1117",
            }}
            onMouseEnter={(e) => {
              if (isPending) return;
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.015)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(163,190,140,0.25)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
            onMouseDown={(e) => {
              if (isPending) return;
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.975)";
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.015)";
            }}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Saving…
              </span>
            ) : (
              "Save profile"
            )}
          </button>

          {/* Divider */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

          {/* Logout */}
          <button
            id="profile-logout-btn"
            type="button"
            onClick={() => logout()}
            disabled={isLoggingOut || isPending}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: "#6b7a8d", background: "transparent" }}
            onMouseEnter={(e) => {
              if (isLoggingOut || isPending) return;
              (e.currentTarget as HTMLButtonElement).style.color = "#bf616a";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(191,97,106,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#6b7a8d";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            {isLoggingOut ? "Signing out…" : "Log out"}
          </button>
        </form>
      </div>
    </main>
  );
}
