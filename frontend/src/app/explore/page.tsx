"use client";

import { useRouter } from "next/navigation";
import Navbar from "@/components/common/Navbar";
import { usePublicRooms, useJoinRoomById, useJoinedRooms, useOwnedRooms } from "@/hooks/useRooms";
import type { RoomSummary } from "@/types/room";

/* ── Skeleton loader ────────────────────────────────────────────────── */
function RoomSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
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
function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 14, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(163,190,140,0.08)", border: "1px solid rgba(163,190,140,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a3be8c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#d8dee9" }}>
          No public rooms found
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7a8d" }}>
          Be the first to create a public room and share your music!
        </p>
      </div>
    </div>
  );
}

function PublicRoomCard({ room, isMember }: { room: RoomSummary; isMember: boolean }) {
  const router = useRouter();
  const { mutate: joinRoom, isPending: isJoining } = useJoinRoomById();

  const handleJoinOrEnter = () => {
    if (isMember) {
      router.push(`/room/${room.id}`);
    } else {
      joinRoom(room.id, {
        onSuccess: () => {
          router.push(`/room/${room.id}`);
        }
      });
    }
  };

  const d = new Date(room.createdAt);
  const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div
      style={{
        background: "rgba(22,27,34,0.65)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transition: "border-color 0.2s, box-shadow 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.13)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#eceff4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {room.name}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#6b7a8d" }}>
            Created {dateStr}
          </p>
        </div>
        {isMember && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "#8fbcbb", background: "rgba(143,188,187,0.1)", padding: "2px 6px", borderRadius: 4 }}>
            JOINED
          </span>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#a8b5c8", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {room.description || "No description provided."}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={handleJoinOrEnter}
          disabled={isJoining}
          style={{
            flex: 1,
            padding: "8px 0",
            borderRadius: 8,
            border: "none",
            background: isMember ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)",
            color: isMember ? "#d8dee9" : "#0f1117",
            fontSize: 12,
            fontWeight: 600,
            cursor: isJoining ? "not-allowed" : "pointer",
            transition: "opacity 0.15s, background 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            opacity: isJoining ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!isJoining && isMember) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)";
            else if (!isJoining && !isMember) (e.currentTarget as HTMLButtonElement).style.opacity = "0.88";
          }}
          onMouseLeave={(e) => {
            if (!isJoining && isMember) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
            else if (!isJoining && !isMember) (e.currentTarget as HTMLButtonElement).style.opacity = "1";
          }}
        >
          {isJoining ? (
             "Joining..."
          ) : isMember ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Enter
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Join Room
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const { data: publicRooms, isLoading } = usePublicRooms();
  const { data: joinedRooms = [] } = useJoinedRooms();
  const { data: ownedRooms = [] } = useOwnedRooms();

  const memberOfRoomIds = new Set([
    ...joinedRooms.map(r => r.id),
    ...ownedRooms.map(r => r.id)
  ]);

  return (
    <div className="min-h-screen bg-[#0f1117] text-[#eceff4] selection:bg-[#a3be8c]/30 selection:text-[#a3be8c] pb-20">
      <Navbar />

      <main className="max-w-5xl mx-auto px-5 pt-32 sm:pt-40">
        <header style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#eceff4", letterSpacing: "-0.02em" }}>
            Explore
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#8a96a8", maxWidth: 480, lineHeight: 1.5 }}>
            Discover and join public music rooms. Share your vibe or tune into what others are listening to!
          </p>
        </header>

        {isLoading ? (
          <RoomSkeleton />
        ) : publicRooms && publicRooms.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {publicRooms.map((room) => (
              <PublicRoomCard 
                key={room.id} 
                room={room} 
                isMember={memberOfRoomIds.has(room.id)} 
              />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </main>
    </div>
  );
}
