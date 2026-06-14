"use client";

import { useState, useEffect, useRef } from "react";
import { useCreateRoom } from "@/hooks/useRooms";
import type { CreateRoomPayload, Visibility } from "@/types/room";

interface Props {
  open: boolean;
  onClose: () => void;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.15)" strokeWidth="3" />
      <path d="M12 2 A10 10 0 0 1 22 12" stroke="#0f1117" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function CreateRoomModal({ open, onClose }: Props) {
  const { mutate: createRoom, isPending, reset } = useCreateRoom();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(""); setDescription(""); setVisibility("public");
      setShuffleEnabled(false); setNameError(null); reset();
      setTimeout(() => nameRef.current?.focus(), 60);
    }
  }, [open, reset]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError("Room name is required."); return; }
    setNameError(null);

    const payload: CreateRoomPayload = {
      name: name.trim(),
      visibility,
      shuffleEnabled,
      ...(description.trim() && { description: description.trim() }),
    };

    createRoom(payload, {
      onSuccess: () => onClose(),
    });
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        animation: "fadeIn 0.15s ease",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%", maxWidth: 460,
          background: "rgba(18,22,30,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          padding: "28px 28px 24px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          animation: "slideUp 0.2s ease",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#eceff4" }}>Create a room</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7a8d" }}>Set up a new music room for your crew.</p>
          </div>
          <button
            type="button" onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7a8d", padding: 4, borderRadius: 6, lineHeight: 0 }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }} noValidate>
          {/* Room name */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="cr-name" style={{ fontSize: 12, fontWeight: 500, color: "#d8dee9" }}>
              Room name <span style={{ color: "#bf616a" }}>*</span>
            </label>
            <input
              ref={nameRef}
              id="cr-name" type="text" value={name} maxLength={100}
              placeholder="Friday Night Vibes"
              onChange={(e) => setName(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#eceff4",
                outline: "none", transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(163,190,140,0.5)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {/* Description */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="cr-desc" style={{ fontSize: 12, fontWeight: 500, color: "#d8dee9" }}>
              Description <span style={{ fontSize: 11, color: "#6b7a8d", fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              id="cr-desc" value={description} maxLength={500} rows={2}
              placeholder="What's this room about?"
              onChange={(e) => setDescription(e.target.value)}
              style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#eceff4",
                outline: "none", resize: "none", transition: "border-color 0.2s", fontFamily: "inherit",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(163,190,140,0.5)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {/* Visibility */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#d8dee9" }}>Visibility</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(["public", "private"] as Visibility[]).map((v) => (
                <button
                  key={v} type="button"
                  onClick={() => setVisibility(v)}
                  style={{
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    border: visibility === v ? "1px solid rgba(163,190,140,0.45)" : "1px solid rgba(255,255,255,0.08)",
                    background: visibility === v ? "rgba(163,190,140,0.1)" : "rgba(255,255,255,0.03)",
                    color: visibility === v ? "#a3be8c" : "#6b7a8d",
                    fontSize: 13, fontWeight: visibility === v ? 600 : 400,
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 7,
                  }}
                >
                  {v === "public" ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  )}
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Shuffle toggle */}
          <label
            htmlFor="cr-shuffle"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.02)", cursor: "pointer",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#d8dee9" }}>Shuffle mode</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a8d" }}>Play songs in random order</p>
            </div>
            <div
              style={{
                width: 38, height: 22, borderRadius: 11, position: "relative", flexShrink: 0,
                background: shuffleEnabled ? "#a3be8c" : "rgba(255,255,255,0.12)",
                transition: "background 0.2s",
              }}
            >
              <input id="cr-shuffle" type="checkbox" checked={shuffleEnabled} onChange={(e) => setShuffleEnabled(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: "absolute", top: 3, left: shuffleEnabled ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
            </div>
          </label>

          {/* Name validation error (client-side only) */}
          {nameError && (
            <p style={{ margin: 0, fontSize: 12, color: "#bf616a", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {nameError}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#6b7a8d", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#d8dee9"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.18)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#6b7a8d"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
            >
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              style={{
                flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
                background: isPending ? "rgba(163,190,140,0.5)" : "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
                color: "#0f1117", fontSize: 13, fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "opacity 0.15s",
              }}
            >
              {isPending ? <><Spinner /> Creating…</> : "Create room"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
