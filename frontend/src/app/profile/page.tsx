"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Navbar from "@/components/common/Navbar";
import { useMe, useUpdateProfile, useLogout, checkUsernameAvailable } from "@/hooks/useAuth";
import { useAuthStore } from "@/store";

/* ─── Constants ─────────────────────────────────────────────────────── */

const USERNAME_DEBOUNCE_MS = 500;
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

/* ─── Helpers ───────────────────────────────────────────────────────── */

function Spinner({ color = "#0f1117", size = 16 }: { color?: string; size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.15)" strokeWidth="3" />
      <path d="M12 2 A10 10 0 0 1 22 12" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Validate username client-side, returns error string or "" */
function validateUsernameLocally(value: string): string {
  if (!value) return "";
  if (value.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters`;
  if (value.length > USERNAME_MAX) return `Max ${USERNAME_MAX} characters`;
  if (!USERNAME_REGEX.test(value)) return "Only letters, numbers and underscores";
  return "";
}

/* ─── Small UI pieces ───────────────────────────────────────────────── */

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "rgba(22,27,34,0.6)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "16px",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#eceff4", letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      {description && (
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7a8d" }}>{description}</p>
      )}
    </div>
  );
}

function AvatarEditor({
  avatarUrl, name, preview, onClick,
}: {
  avatarUrl: string | null;
  name: string | null;
  preview: string | null;
  onClick: () => void;
}) {
  const initials = (name || "?")
    .trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const src = preview || avatarUrl;
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      id="avatar-upload-btn"
      onClick={onClick}
      aria-label="Change profile photo"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        width: "88px",
        height: "88px",
        borderRadius: "50%",
        border: hovered ? "2px solid rgba(163,190,140,0.6)" : "2px solid rgba(163,190,140,0.25)",
        background: src
          ? "transparent"
          : "linear-gradient(135deg, rgba(163,190,140,0.2) 0%, rgba(143,188,187,0.15) 100%)",
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "all 0.2s ease",
        outline: "none",
        boxShadow: hovered
          ? "0 0 0 4px rgba(163,190,140,0.1), 0 8px 24px rgba(0,0,0,0.4)"
          : "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {src ? (
        <img src={src} alt="Profile avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: "26px", fontWeight: 700, color: "#a3be8c", userSelect: "none" }}>
          {initials}
        </span>
      )}
      <span
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: hovered ? 1 : 0, transition: "opacity 0.2s",
          flexDirection: "column", gap: "4px",
          color: "#eceff4", fontSize: "10px", fontWeight: 600, letterSpacing: "0.04em",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span>Change</span>
      </span>
    </button>
  );
}

/* ─── Username field with debounce check ────────────────────────────── */

type UsernameStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; message: string }
  | { state: "invalid"; message: string };

function UsernameField({
  value,
  onChange,
  currentUsername,
}: {
  value: string;
  onChange: (v: string, status: UsernameStatus) => void;
  currentUsername: string | null | undefined;
}) {
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<UsernameStatus>({ state: "idle" });
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValue = useRef(value);

  // Check availability with debounce
  const scheduleCheck = useCallback(
    (val: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      // Already same as current saved username — skip check
      if (val === currentUsername) {
        const next: UsernameStatus = { state: "idle" };
        setStatus(next);
        onChange(val, next);
        return;
      }

      const localErr = validateUsernameLocally(val);
      if (localErr) {
        const next: UsernameStatus = { state: "invalid", message: localErr };
        setStatus(next);
        onChange(val, next);
        return;
      }

      // Show checking state immediately
      const checking: UsernameStatus = { state: "checking" };
      setStatus(checking);
      onChange(val, checking);

      debounceTimer.current = setTimeout(async () => {
        if (latestValue.current !== val) return; // stale, skip
        const result = await checkUsernameAvailable(val);
        if (latestValue.current !== val) return; // stale after await
        const next: UsernameStatus = result.available
          ? { state: "available" }
          : { state: "taken", message: result.message };
        setStatus(next);
        onChange(val, next);
      }, USERNAME_DEBOUNCE_MS);
    },
    [currentUsername, onChange]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\s/g, "");
    latestValue.current = raw;
    scheduleCheck(raw);
  }

  // Border color based on status
  const borderColor = (() => {
    if (!value) return focused ? "rgba(163,190,140,0.45)" : "rgba(255,255,255,0.08)";
    if (status.state === "invalid" || status.state === "taken")
      return focused ? "rgba(191,97,106,0.6)" : "rgba(191,97,106,0.4)";
    if (status.state === "available")
      return focused ? "rgba(163,190,140,0.6)" : "rgba(163,190,140,0.4)";
    return focused ? "rgba(163,190,140,0.45)" : "rgba(255,255,255,0.08)";
  })();

  const boxShadow = (() => {
    if (!focused) return "none";
    if (status.state === "invalid" || status.state === "taken")
      return "0 0 0 3px rgba(191,97,106,0.1)";
    return "0 0 0 3px rgba(163,190,140,0.07)";
  })();

  // Trailing status icon/text
  const trailingEl = (() => {
    if (!value) return null;
    if (status.state === "checking")
      return (
        <span style={{ paddingRight: "12px", display: "flex", alignItems: "center" }}>
          <Spinner color="#6b7a8d" size={13} />
        </span>
      );
    if (status.state === "available")
      return (
        <span style={{ paddingRight: "12px", display: "flex", alignItems: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a3be8c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      );
    if (status.state === "taken" || status.state === "invalid")
      return (
        <span style={{ paddingRight: "12px", display: "flex", alignItems: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#bf616a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </span>
      );
    return null;
  })();

  const errorMessage = (status.state === "taken" || status.state === "invalid") ? status.message : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label htmlFor="profile-username" style={{ fontSize: "12px", fontWeight: 500, color: "#d8dee9", letterSpacing: "0.02em" }}>
        Username
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${borderColor}`,
          borderRadius: "10px",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow,
        }}
      >
        <span style={{ paddingLeft: "14px", paddingRight: "3px", fontSize: "13px", color: "#6b7a8d", userSelect: "none" }} aria-hidden="true">
          @
        </span>
        <input
          id="profile-username"
          type="text"
          autoComplete="username"
          placeholder="yourhandle"
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={USERNAME_MAX}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            padding: "11px 6px 11px 0",
            fontSize: "13px",
            color: "#eceff4",
            width: "100%",
          }}
        />
        {trailingEl}
      </div>
      {errorMessage && (
        <p style={{ margin: 0, fontSize: "11.5px", color: "#bf616a", display: "flex", alignItems: "center", gap: "4px" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {errorMessage}
        </p>
      )}
      {status.state === "available" && (
        <p style={{ margin: 0, fontSize: "11.5px", color: "#a3be8c", display: "flex", alignItems: "center", gap: "4px" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Username is available
        </p>
      )}
    </div>
  );
}

/* ─── Simple text input ─────────────────────────────────────────────── */

function InputField({
  id, label, value, onChange, placeholder, disabled = false, prefix,
}: {
  id: string; label: string; value: string;
  onChange?: (v: string) => void;
  placeholder?: string; disabled?: boolean; prefix?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label htmlFor={id} style={{ fontSize: "12px", fontWeight: 500, color: "#d8dee9", letterSpacing: "0.02em" }}>
        {label}
      </label>
      <div
        style={{
          display: "flex", alignItems: "center",
          background: disabled ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
          border: disabled ? "1px solid rgba(255,255,255,0.05)"
            : focused ? "1px solid rgba(163,190,140,0.45)"
            : "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: !disabled && focused ? "0 0 0 3px rgba(163,190,140,0.07)" : "none",
        }}
      >
        {prefix && (
          <span style={{ paddingLeft: "14px", paddingRight: "3px", fontSize: "13px", color: "#6b7a8d", userSelect: "none" }} aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={id} type="text" value={value} disabled={disabled} placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            padding: prefix ? "11px 14px 11px 0" : "11px 14px",
            fontSize: "13px",
            color: disabled ? "#4a5568" : "#eceff4",
            cursor: disabled ? "default" : "text", width: "100%",
          }}
        />
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────── */

export default function ProfilePage() {
  useMe();

  const user = useAuthStore((s) => s.user);
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>({ state: "idle" });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setUsername(user.username ?? "");
    }
  }, [user]);

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
    // Block submit if username is being checked or is invalid/taken
    if (usernameStatus.state === "checking" || usernameStatus.state === "taken" || usernameStatus.state === "invalid") return;

    const formData = new FormData();
    if (name.trim()) formData.append("name", name.trim());
    if (username.trim()) formData.append("username", username.trim());
    if (avatarFile) formData.append("avatar", avatarFile);

    updateProfile(formData, {
      onSuccess: () => {
        setAvatarFile(null);
        setUsernameStatus({ state: "idle" });
      },
    });
  }

  const handleUsernameChange = useCallback((val: string, status: UsernameStatus) => {
    setUsername(val);
    setUsernameStatus(status);
  }, []);

  const isSaveDisabled =
    isPending ||
    usernameStatus.state === "checking" ||
    usernameStatus.state === "taken" ||
    usernameStatus.state === "invalid";

  const profileComplete = !!(user?.name || user?.username);

  return (
    <div className="min-h-screen w-full" style={{ background: "#0b0f16", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Ambient glows */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "600px", height: "600px", background: "radial-gradient(ellipse at center, rgba(163,190,140,0.06) 0%, transparent 65%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "-8%", width: "500px", height: "500px", background: "radial-gradient(ellipse at center, rgba(143,188,187,0.05) 0%, transparent 65%)", filter: "blur(60px)" }} />
      </div>

      <Navbar />

      <main
        className="profile-main-layout"
        style={{
          position: "relative", zIndex: 1,
          maxWidth: "900px", margin: "0 auto",
          padding: "110px 24px 80px",
          display: "grid",
          gridTemplateColumns: "200px 1fr",
          gap: "28px",
          alignItems: "start",
        }}
      >
        {/* ── Sidebar ── */}
        <aside>
          <div
            style={{
              background: "rgba(22,27,34,0.6)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "14px",
              padding: "20px",
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: "10px", textAlign: "center",
            }}
          >
            {/* Mini avatar */}
            <div
              style={{
                width: "56px", height: "56px", borderRadius: "50%",
                border: "2px solid rgba(163,190,140,0.25)",
                background: "linear-gradient(135deg, rgba(163,190,140,0.15) 0%, rgba(143,188,187,0.1) 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden", flexShrink: 0,
              }}
            >
              {avatarPreview || user?.avatarUrl ? (
                <img src={avatarPreview || user?.avatarUrl || ""} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: "18px", fontWeight: 700, color: "#a3be8c", userSelect: "none" }}>
                  {(user?.name || user?.username || "?").trim().split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                </span>
              )}
            </div>

            <div>
              <p style={{ margin: "0 0 2px", fontSize: "13px", fontWeight: 600, color: "#eceff4" }}>
                {user?.name || user?.username || "New user"}
              </p>
              <p style={{ margin: 0, fontSize: "11px", color: "#6b7a8d" }}>{user?.username ? `@${user.username}` : "No username set"}</p>
            </div>

            {!profileComplete && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "3px 10px", borderRadius: "20px",
                background: "rgba(163,190,140,0.1)", border: "1px solid rgba(163,190,140,0.2)",
                color: "#a3be8c", fontSize: "10px", fontWeight: 600,
                letterSpacing: "0.04em", textTransform: "uppercase",
              }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Incomplete
              </span>
            )}
          </div>

          {/* Nav */}
          <div style={{ marginTop: "12px", background: "rgba(22,27,34,0.6)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "8px" }}>
            <p style={{ margin: "0 0 4px", padding: "4px 8px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(107,122,141,0.7)", textTransform: "uppercase" }}>
              Settings
            </p>
            {/* Account — active */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", background: "rgba(163,190,140,0.12)", color: "#a3be8c", fontWeight: 600, fontSize: "14px" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Account
              <span style={{ marginLeft: "auto", width: "4px", height: "4px", borderRadius: "50%", background: "#a3be8c" }} />
            </div>
          </div>
        </aside>

        {/* ── Content ── */}
        <div>
          <div style={{ marginBottom: "24px" }}>
            <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700, color: "#eceff4", letterSpacing: "-0.02em" }}>
              Account settings
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "#6b7a8d" }}>
              Manage your profile, photo, and personal details.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Avatar card */}
            <SectionCard>
              <SectionHeader title="Profile photo" description="Shown on your public profile and in rooms." />
              <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: "20px" }}>
                <AvatarEditor
                  avatarUrl={user?.avatarUrl ?? null}
                  name={user?.name ?? null}
                  preview={avatarPreview}
                  onClick={() => fileInputRef.current?.click()}
                />
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: "14px", color: "#d8dee9", fontWeight: 500 }}>
                    {user?.name || user?.username || "Your name"}
                  </p>
                  <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#6b7a8d" }}>{user?.username ? `@${user.username}` : ""}</p>
                  <button
                    type="button"
                    id="upload-photo-btn"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      padding: "6px 14px", borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.05)",
                      color: "#d8dee9", fontSize: "12px", fontWeight: 500,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.09)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Upload photo
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Personal info card */}
            <SectionCard>
              <SectionHeader title="Personal information" />
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="profile-fields-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <InputField
                    id="profile-name"
                    label="Display name"
                    value={name}
                    onChange={setName}
                    placeholder="Your display name"
                  />
                  <UsernameField
                    value={username}
                    onChange={handleUsernameChange}
                    currentUsername={user?.username}
                  />
                </div>

              </div>



              {/* Card footer */}
              <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "flex-end" }}>
                <button
                  id="profile-save-btn"
                  type="submit"
                  disabled={isSaveDisabled}
                  title={
                    usernameStatus.state === "checking" ? "Checking username…"
                    : usernameStatus.state === "taken" ? "Username is taken"
                    : usernameStatus.state === "invalid" ? "Fix username errors first"
                    : undefined
                  }
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "8px",
                    padding: "9px 22px", borderRadius: "10px", border: "none",
                    background: isSaveDisabled
                      ? "rgba(163,190,140,0.4)"
                      : "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
                    color: "#0f1117",
                    fontSize: "13px", fontWeight: 600,
                    cursor: isSaveDisabled ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: isSaveDisabled ? "none" : "0 4px 14px rgba(163,190,140,0.2)",
                    opacity: isSaveDisabled && !isPending ? 0.65 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (isSaveDisabled) return;
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(163,190,140,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = isSaveDisabled ? "none" : "0 4px 14px rgba(163,190,140,0.2)";
                  }}
                >
                  {isPending ? (
                    <><Spinner />Saving…</>
                  ) : usernameStatus.state === "checking" ? (
                    <><Spinner color="#0f1117" />Checking…</>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      Save changes
                    </>
                  )}
                </button>
              </div>
            </SectionCard>
          </form>
        </div>
      </main>

      <input
        ref={fileInputRef}
        id="avatar-file-input"
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
        aria-label="Upload profile photo"
      />
    </div>
  );
}
