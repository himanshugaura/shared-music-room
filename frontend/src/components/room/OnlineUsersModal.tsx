"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { OnlineUser } from "@/types/room";

interface Props {
  open: boolean;
  onClose: () => void;
  onlineUsers: OnlineUser[];
  ownerId: string;
  currentUserId?: string;
}

function UserAvatar({ user, size = 36 }: { user: OnlineUser; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const initials = (user.name ?? user.username ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (user.avatarUrl && !imgError) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name ?? user.username ?? "User"}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
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
        border: "1px solid rgba(163,190,140,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.36),
        fontWeight: 700,
        color: "#a3be8c",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials}
    </span>
  );
}

export function OnlineUsersModal({ open, onClose, onlineUsers, ownerId, currentUserId }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const filtered = onlineUsers.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.name?.toLowerCase().includes(q) ?? false) ||
      (u.username?.toLowerCase().includes(q) ?? false)
    );
  });

  const modalContent = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        padding: 16,
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          background: "#111620",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(163,190,140,0.1)",
          overflow: "hidden",
          animation: "modalFadeIn 0.15s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: "#a3be8c",
                boxShadow: "0 0 8px #a3be8c",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#eceff4" }}>
              Online Listeners
            </h2>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                background: "rgba(163,190,140,0.15)",
                color: "#a3be8c",
                border: "1px solid rgba(163,190,140,0.25)",
              }}
            >
              {onlineUsers.length}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "#6b7a8d",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#d8dee9")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#6b7a8d")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search if > 4 listeners */}
        {onlineUsers.length > 4 && (
          <div style={{ padding: "12px 16px 8px", flexShrink: 0 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listeners..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "#eceff4",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
        )}

        {/* Users list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.length === 0 ? (
            <p style={{ margin: 0, padding: "28px 0", textAlign: "center", color: "#6b7a8d", fontSize: 13 }}>
              No listeners found.
            </p>
          ) : (
            filtered.map((u) => {
              const isOwner = u.id === ownerId;
              const isYou = u.id === currentUserId;
              const displayName = u.name ?? u.username ?? "Anonymous Listener";

              return (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: isYou ? "rgba(163,190,140,0.06)" : "rgba(255,255,255,0.02)",
                    border: isYou ? "1px solid rgba(163,190,140,0.18)" : "1px solid rgba(255,255,255,0.04)",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Left: Avatar with green active dot */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <UserAvatar user={u} size={38} />
                    <span
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: "#a3be8c",
                        border: "2px solid #111620",
                      }}
                    />
                  </div>

                  {/* Middle: Name and Username */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#eceff4",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {displayName}
                    </p>
                    {u.username && (
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 11,
                          color: "#6b7a8d",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        @{u.username}
                      </p>
                    )}
                  </div>

                  {/* Right: Badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {isYou && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "rgba(163,190,140,0.2)",
                          color: "#a3be8c",
                          letterSpacing: "0.04em",
                        }}
                      >
                        YOU
                      </span>
                    )}

                    {isOwner && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "rgba(235,203,139,0.15)",
                          color: "#ebcb8b",
                          border: "1px solid rgba(235,203,139,0.3)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          letterSpacing: "0.04em",
                        }}
                      >
                        👑 HOST
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
}
