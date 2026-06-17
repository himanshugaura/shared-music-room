"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/common/Navbar";
import { useMe } from "@/hooks/useAuth";
import { useOwnedRooms, useJoinedRooms } from "@/hooks/useRooms";
import { useAuthStore } from "@/store";
import RoomCard from "../../components/dashboard/RoomCard";
import CreateRoomModal from "../../components/dashboard/CreateRoomModal";
import JoinRoomModal from "../../components/dashboard/JoinRoomModal";
import type { RoomSummary } from "@/types/room";

/* ── Skeleton loader ────────────────────────────────────────────────── */
function RoomSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 160, borderRadius: 14,
            background: "rgba(22,27,34,0.5)",
            border: "1px solid rgba(255,255,255,0.06)",
            animation: "pulse 1.6s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────── */
function EmptyState({ type, onAction }: { type: "owned" | "joined"; onAction: () => void }) {
  const isOwned = type === "owned";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 14, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(163,190,140,0.08)", border: "1px solid rgba(163,190,140,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a3be8c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {isOwned
            ? <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>
            : <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>
          }
        </svg>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#d8dee9" }}>
          {isOwned ? "No rooms yet" : "Not in any rooms yet"}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7a8d" }}>
          {isOwned ? "Create your first room and invite friends." : "Join a room with a code from a friend."}
        </p>
      </div>
      <button
        type="button" onClick={onAction}
        style={{ padding: "8px 20px", borderRadius: 20, border: "none", background: "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)", color: "#0f1117", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
      >
        {isOwned ? "Create a room" : "Join a room"}
      </button>
    </div>
  );
}

/* ── Main dashboard ─────────────────────────────────────────────────── */
type Tab = "owned" | "joined";

export default function DashboardPage() {
  useMe();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<Tab>("owned");
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const { data: ownedRooms, isLoading: loadingOwned, isError: errorOwned } = useOwnedRooms();
  const { data: joinedRooms, isLoading: loadingJoined, isError: errorJoined } = useJoinedRooms();

  function handleEnter(room: RoomSummary) {
    router.push(`/room/${room.id}`);
  }

  const isLoading = tab === "owned" ? loadingOwned : loadingJoined;
  const isError = tab === "owned" ? errorOwned : errorJoined;
  const rooms = tab === "owned" ? (ownedRooms ?? []) : (joinedRooms ?? []);

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f16", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Ambient glows */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-5%", right: "-5%", width: 600, height: 600, background: "radial-gradient(ellipse at center, rgba(163,190,140,0.06) 0%, transparent 65%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "-8%", width: 500, height: 500, background: "radial-gradient(ellipse at center, rgba(143,188,187,0.05) 0%, transparent 65%)", filter: "blur(60px)" }} />
      </div>

      <Navbar />

      <main style={{ position: "relative", zIndex: 1, maxWidth: 1000, margin: "0 auto", padding: "100px 24px 80px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#eceff4", letterSpacing: "-0.02em" }}>
              Hey, {user?.name || user?.username || "there"} 👋
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7a8d" }}>
              Your music rooms — all in one place.
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button
              id="explore-rooms-btn"
              type="button"
              onClick={() => router.push("/explore")}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 18px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "#d8dee9", fontSize: 13, fontWeight: 500,
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.09)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              Explore public rooms
            </button>
            <button
              id="join-room-btn"
              type="button"
              onClick={() => setJoinOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 18px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "#d8dee9", fontSize: 13, fontWeight: 500,
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.09)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              Join room
            </button>
            <button
              id="create-room-btn"
              type="button"
              onClick={() => setCreateOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 18px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
                color: "#0f1117", fontSize: 13, fontWeight: 600,
                cursor: "pointer", transition: "opacity 0.15s",
                boxShadow: "0 4px 14px rgba(163,190,140,0.22)",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "0.88")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Create room
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex", gap: 4, marginBottom: 24,
            background: "rgba(22,27,34,0.6)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: 4,
            width: "fit-content",
          }}
        >
          {(["owned", "joined"] as Tab[]).map((t) => {
            const active = tab === t;
            const count = t === "owned" ? (ownedRooms?.length ?? 0) : (joinedRooms?.length ?? 0);
            return (
              <button
                key={t}
                id={`tab-${t}`}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 16px", borderRadius: 9, border: "none",
                  background: active ? "rgba(163,190,140,0.12)" : "transparent",
                  color: active ? "#a3be8c" : "#6b7a8d",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {t === "owned" ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                )}
                {t === "owned" ? "Created" : "Joined"}
                {count > 0 && (
                  <span style={{
                    padding: "1px 7px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: active ? "rgba(163,190,140,0.2)" : "rgba(255,255,255,0.07)",
                    color: active ? "#a3be8c" : "#6b7a8d",
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {isLoading && <RoomSkeleton />}

        {isError && !isLoading && (
          <div style={{ padding: "24px", borderRadius: 12, background: "rgba(191,97,106,0.08)", border: "1px solid rgba(191,97,106,0.2)", color: "#bf616a", fontSize: 13 }}>
            Failed to load rooms. Please refresh and try again.
          </div>
        )}

        {!isLoading && !isError && rooms.length === 0 && (
          <EmptyState
            type={tab}
            onAction={() => tab === "owned" ? setCreateOpen(true) : setJoinOpen(true)}
          />
        )}

        {!isLoading && !isError && rooms.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                isOwner={tab === "owned"}
                onEnter={handleEnter}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinRoomModal open={joinOpen} onClose={() => setJoinOpen(false)} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
