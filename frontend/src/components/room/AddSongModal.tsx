"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useAddTrack } from "@/hooks/useRoom";
import type { YTPlayer } from "@/types/youtube";
import { ensureYTApi } from "@/lib/youtube";

// ── YouTube URL helpers ───────────────────────────────────────────────────────

function extractVideoId(input: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const re of patterns) {
    const m = input.trim().match(re);
    if (m) return m[1];
  }
  return null;
}



// ── YouTube Data API v3 search ────────────────────────────────────────────────

const YT_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY!;
const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

interface SearchResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSec: number;
}

/** Parse ISO 8601 duration (PT3M45S) → seconds */
function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

async function searchYouTube(query: string): Promise<SearchResult[]> {
  // 1) search — get video IDs + basic snippet
  const searchRes = await fetch(
    `${YT_API_BASE}/search?part=snippet&type=video&videoCategoryId=10&maxResults=12` +
    `&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`
  );
  if (!searchRes.ok) throw new Error("Search failed");
  const searchData = await searchRes.json();
  const items: Array<{ id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: { high?: { url: string }; medium?: { url: string } } } }> =
    searchData.items ?? [];
  if (items.length === 0) return [];

  const ids = items.map((i) => i.id.videoId).join(",");

  // 2) videos — get contentDetails for duration
  const detailRes = await fetch(
    `${YT_API_BASE}/videos?part=contentDetails&id=${ids}&key=${YT_API_KEY}`
  );
  if (!detailRes.ok) throw new Error("Details fetch failed");
  const detailData = await detailRes.json();
  const durationMap: Record<string, number> = {};
  for (const v of detailData.items ?? []) {
    durationMap[v.id] = parseDuration(v.contentDetails.duration);
  }

  return items.map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail:
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.medium?.url ??
      `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
    durationSec: durationMap[item.id.videoId] ?? 0,
  }));
}

// ── Misc formatters ───────────────────────────────────────────────────────────

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function destroyYTPlayer(player: Partial<YTPlayer> | null): void {
  if (typeof player?.destroy !== "function") return;
  try {
    player.destroy();
  } catch {
    // The iframe may already be gone when React hides the modal.
  }
}



// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  roomId: string;
  open: boolean;
  onClose: () => void;
}

export function AddSongModal({ roomId, open, onClose }: Props) {
  // ── State ───────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{
    videoId: string;
    title: string;
    thumbnail: string;
    durationMs: number | null;
    fromSearch: boolean;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Partial<YTPlayer> | null>(null);
  const { mutate: addTrack, isPending: adding } = useAddTrack(roomId);

  // ── Reset on open/close ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      destroyYTPlayer(playerRef.current);
      playerRef.current = null;
    };
  }, []);

  // ── Preview YT player ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedVideo?.videoId || !open) return;

    const host = previewHostRef.current;
    if (!host) return;

    setPreviewLoading(true);
    let cancelled = false;
    const mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "100%";
    host.replaceChildren(mount);

    ensureYTApi(() => {
      if (cancelled) return;

      playerRef.current = new window.YT.Player(mount, {
        videoId: selectedVideo.videoId,
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: ({ target }) => {
            if (cancelled) return;
            playerRef.current = target;
            const dur = target.getDuration();
            setPreviewLoading(false);
            setSelectedVideo((prev) =>
              prev ? { ...prev, durationMs: Math.round(dur * 1000) } : prev
            );
          },
          onStateChange: ({ data, target }) => {
            // YT.PlayerState.CUED = 5, fired when the preview video is ready.
            if (data === 5) {
              const dur = target.getDuration();
              setPreviewLoading(false);
              setSelectedVideo((prev) =>
                prev ? { ...prev, durationMs: Math.round(dur * 1000) } : prev
              );
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      destroyYTPlayer(playerRef.current);
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [selectedVideo?.videoId, open]);

  // ── Input handler ────────────────────────────────────────────────────────────
  function handleInput(val: string) {
    setQuery(val);
    setSearchError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Direct URL or video ID
    const videoId = extractVideoId(val);
    if (videoId) {
      setResults([]);
      setSearching(false);
      setSelectedVideo({ videoId, title: "", thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, durationMs: null, fromSearch: false });
      return;
    }

    // Empty
    if (!val.trim()) {
      setResults([]);
      setSearching(false);
      setSelectedVideo(null);
      return;
    }

    // Text search (debounced 500 ms)
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchYouTube(val.trim());
        setResults(res);
        setSearchError(res.length === 0 ? "No results found." : null);
      } catch {
        setSearchError("Search unavailable. Please paste a YouTube URL instead.");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  }

  function selectResult(r: SearchResult) {
    setSelectedVideo({
      videoId: r.videoId,
      title: r.title,
      thumbnail: r.thumbnail,
      durationMs: r.durationSec > 0 ? r.durationSec * 1000 : null,
      fromSearch: true,
    });
  }

  function handleAdd() {
    if (!selectedVideo || !selectedVideo.durationMs) return;
    addTrack(
      {
        youtubeVideoId: selectedVideo.videoId,
        title: selectedVideo.title || `YouTube — ${selectedVideo.videoId}`,
        thumbnail: selectedVideo.thumbnail,
        durationMs: selectedVideo.durationMs,
      },
      { onSuccess: () => onClose() }
    );
  }

  if (!open) return null;

  const canAdd = !!selectedVideo?.durationMs && !adding;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "100%", maxWidth: 560,
          background: "rgba(13,17,23,0.99)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(163,190,140,0.05)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {selectedVideo?.fromSearch && (
              <button
                onClick={() => setSelectedVideo(null)}
                style={{ background: "none", border: "none", color: "#6b7a8d", cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Results
              </button>
            )}
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#eceff4" }}>
              {selectedVideo ? "Preview & add" : "Add song to queue"}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#6b7a8d", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Search input (always visible when no video selected) ─────────── */}
        {!selectedVideo && (
          <div style={{ padding: "16px 20px 12px", flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7a8d"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                autoFocus
                value={query}
                onChange={(e) => handleInput(e.target.value)}
                placeholder="Search YouTube or paste a URL / video ID…"
                style={{
                  width: "100%", boxSizing: "border-box",
                  paddingLeft: 38, paddingRight: query ? 38 : 14, paddingTop: 11, paddingBottom: 11,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#eceff4", fontSize: 13, outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(163,190,140,0.5)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setResults([]); setSelectedVideo(null); setSearchError(null); }}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6b7a8d", cursor: "pointer", padding: 2, display: "flex" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Results list ─────────────────────────────────────────────────── */}
        {!selectedVideo && (
          <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
            {/* Loading */}
            {searching && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 0", color: "#6b7a8d", fontSize: 13 }}>
                <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                  <path d="M12 2A10 10 0 0 1 22 12" stroke="#a3be8c" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Searching…
              </div>
            )}

            {/* Error */}
            {!searching && searchError && (
              <div style={{ padding: "24px 8px", textAlign: "center", color: "#6b7a8d", fontSize: 13 }}>
                {searchError}
              </div>
            )}

            {/* Empty hint */}
            {!searching && !searchError && results.length === 0 && !query && (
              <div style={{ padding: "28px 8px", textAlign: "center" }}>
                <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10, color: "#6b7a8d" }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#d8dee9" }}>Search for a song</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12 }}>Type a song name, or paste a YouTube URL</p>
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            {!searching && results.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {results.map((r) => (
                  <button
                    key={r.videoId}
                    onClick={() => selectResult(r)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      width: "100%", textAlign: "left",
                      padding: "8px 8px", borderRadius: 10,
                      border: "none", background: "transparent",
                      cursor: "pointer", transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
                  >
                    {/* Thumbnail */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <img
                        src={r.thumbnail}
                        alt=""
                        width={88}
                        height={50}
                        style={{ borderRadius: 6, objectFit: "cover", display: "block", background: "#1a1f2a" }}
                      />
                      {r.durationSec > 0 && (
                        <span style={{
                          position: "absolute", bottom: 4, right: 4,
                          background: "rgba(0,0,0,0.8)", color: "#fff",
                          fontSize: 10, fontWeight: 600, padding: "1px 4px",
                          borderRadius: 3, fontFamily: "monospace",
                        }}>
                          {fmtSec(r.durationSec)}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontSize: 13, fontWeight: 500, color: "#d8dee9",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        {r.title}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7a8d" }}>
                        {r.channel}
                      </p>
                    </div>

                    {/* Add arrow */}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7a8d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Preview (video selected) ─────────────────────────────────────── */}
        {selectedVideo && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* YT player embed */}
            <div style={{ position: "relative", aspectRatio: "16/9", background: "#000", flexShrink: 0 }}>
              {previewLoading && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", zIndex: 1 }}>
                  <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                    <path d="M12 2A10 10 0 0 1 22 12" stroke="#a3be8c" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              {/* Isolated container to prevent React DOM errors when YT replaces the child */}
              <div ref={previewHostRef} style={{ width: "100%", height: "100%" }} />
            </div>

            {/* Video info */}
            <div style={{ padding: "14px 20px 0" }}>
              {selectedVideo.title ? (
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#eceff4" }}>{selectedVideo.title}</p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "#6b7a8d" }}>Loading info…</p>
              )}
              {selectedVideo.durationMs && (
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7a8d" }}>
                  {fmtSec(selectedVideo.durationMs / 1000)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        {selectedVideo && (
          <div style={{ display: "flex", gap: 10, padding: "14px 20px 20px", flexShrink: 0 }}>
            <button
              onClick={selectedVideo.fromSearch ? () => setSelectedVideo(null) : onClose}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#6b7a8d", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
            >
              {selectedVideo.fromSearch ? "← Back" : "Cancel"}
            </button>
            <button
              onClick={handleAdd}
              disabled={!canAdd}
              style={{
                flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
                background: canAdd ? "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)" : "rgba(163,190,140,0.25)",
                color: "#0f1117", fontSize: 13, fontWeight: 700,
                cursor: canAdd ? "pointer" : "not-allowed",
                transition: "opacity 0.15s",
                opacity: adding ? 0.7 : 1,
              }}
            >
              {adding ? "Adding…" : previewLoading ? "Loading…" : "Add to queue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
