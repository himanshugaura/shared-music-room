"use client";

import { useState, useEffect, useRef } from "react";
import { useJoinByCode } from "@/hooks/useRooms";

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

export default function JoinRoomModal({ open, onClose }: Props) {
  const { mutate: joinByCode, isPending, reset } = useJoinByCode();

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCode(""); setCodeError(null); reset();
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) { setCodeError("Room code must be 6 characters."); return; }
    setCodeError(null);

    joinByCode(trimmed, {
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
          width: "100%", maxWidth: 400,
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
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#eceff4" }}>Join a room</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7a8d" }}>Enter the 6-character room code.</p>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7a8d", padding: 4, borderRadius: 6, lineHeight: 0 }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }} noValidate>
          {/* Code input */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="jr-code" style={{ fontSize: 12, fontWeight: 500, color: "#d8dee9" }}>Room code</label>
            <input
              ref={inputRef}
              id="jr-code" type="text" value={code} maxLength={6}
              placeholder="A1B2C3"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${codeError ? "rgba(191,97,106,0.5)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "0.25em",
                color: "#eceff4",
                outline: "none",
                textAlign: "center",
                textTransform: "uppercase",
                transition: "border-color 0.2s",
                fontFamily: "monospace",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(163,190,140,0.5)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = codeError ? "rgba(191,97,106,0.5)" : "rgba(255,255,255,0.1)")}
            />
          </div>

          {/* Code validation error (client-side only) */}
          {codeError && (
            <p style={{ margin: 0, fontSize: 12, color: "#bf616a", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {codeError}
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
              {isPending ? <><Spinner /> Joining…</> : "Join room"}
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
