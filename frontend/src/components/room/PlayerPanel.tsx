"use client";

/**
 * PlayerPanel — YouTube embed + owner-only playback controls.
 *
 * The YT IFrame API is loaded once globally (module-level guard).
 * Player controls (play/pause/seek/skip) are rendered exclusively for owners.
 * Members see only the embed and current-song info.
 *
 * Imperative control is exposed via `controlRef` so the parent (RoomPage) can
 * call play/pause/seek/loadVideo in response to socket events without prop-
 * drilling callbacks back up.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { QueueSong, QueueState } from "@/types/room";
import type { YTPlayer } from "@/types/youtube";
import { ensureYTApi } from "@/lib/youtube";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSec(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlayerControls {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  loadVideo: (videoId: string, startSeconds?: number, autoplay?: boolean) => void;
}

interface Props {
  currentSong: QueueSong | null;
  queueState: QueueState | null;
  isOwner: boolean;
  onPlay: () => void;
  onPause: (positionMs: number) => void;
  onSeek: (positionMs: number) => void;
  onSkip: () => void;
  onEnded: () => void;
  controlRef: React.MutableRefObject<PlayerControls | null>;
  onPlayerReady?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlayerPanel({
  currentSong,
  queueState,
  isOwner,
  onPlay,
  onPause,
  onSeek,
  onSkip,
  onEnded,
  controlRef,
  onPlayerReady,
}: Props) {
  const playerContainerId = "yt-main-player";
  const ytRef = useRef<YTPlayer | null>(null);

  // Local state for controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragSec, setDragSec] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  // ── Init YouTube player ───────────────────────────────────────────────────

  useEffect(() => {
    let player: YTPlayer;
    let mounted = true;

    ensureYTApi(() => {
      if (!mounted) return;
      player = new window.YT.Player(playerContainerId, {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 0,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          enablejsapi: 1,
          playsinline: 1,
        },
        events: {
          onReady: ({ target }) => {
            if (!mounted) return;
            ytRef.current = target;
            if (onPlayerReady) onPlayerReady();
          },
          onStateChange: ({ data }) => {
            if (!mounted) return;
            const YS = window.YT.PlayerState;
            if (data === YS.PLAYING) {
              setIsPlaying(true);
              setBuffering(false);
              setDuration(ytRef.current?.getDuration() ?? 0);
            } else if (data === YS.PAUSED) {
              setIsPlaying(false);
            } else if (data === YS.BUFFERING) {
              setBuffering(true);
            } else if (data === YS.ENDED) {
              setIsPlaying(false);
              onEndedRef.current();
            }
          },
        },
      });
    });

    return () => {
      mounted = false;
      player?.destroy();
      ytRef.current = null;
    };
  }, []);

  // ── Progress ticker ───────────────────────────────────────────────────────

  useEffect(() => {
    if (isPlaying && !isDragging) {
      intervalRef.current = setInterval(() => {
        const t = ytRef.current?.getCurrentTime() ?? 0;
        setCurrentSec(t);
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, isDragging]);

  // ── Expose imperative controls to parent (for socket events) ─────────────

  useEffect(() => {
    controlRef.current = {
      play: () => { ytRef.current?.playVideo(); },
      pause: () => { ytRef.current?.pauseVideo(); },
      seekTo: (seconds) => { ytRef.current?.seekTo(seconds, true); setCurrentSec(seconds); },
      loadVideo: (videoId, startSeconds = 0, autoplay = true) => {
        if (autoplay) {
          ytRef.current?.loadVideoById({ videoId, startSeconds });
        } else {
          ytRef.current?.cueVideoById({ videoId, startSeconds });
        }
        setCurrentSec(startSeconds);
      },
    };
    return () => { controlRef.current = null; };
  }, [controlRef]);

  // ── Owner control handlers ────────────────────────────────────────────────

  const handlePlayPause = useCallback(() => {
    if (!ytRef.current) return;
    if (isPlaying) {
      ytRef.current.pauseVideo();
      onPause(Math.round((ytRef.current.getCurrentTime() ?? 0) * 1000));
    } else {
      ytRef.current.playVideo();
      onPlay();
    }
  }, [isPlaying, onPause, onPlay]);

  const handleSeekCommit = useCallback((sec: number) => {
    ytRef.current?.seekTo(sec, true);
    setCurrentSec(sec);
    onSeek(Math.round(sec * 1000));
  }, [onSeek]);

  const displaySec = isDragging ? dragSec : currentSec;
  const progress = duration > 0 ? displaySec / duration : 0;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#0b0f16",
      }}
    >
      {/* ── YouTube embed ─────────────────────────────────────────────── */}
      <div style={{ position: "relative", flex: 1, background: "#000", minHeight: 0 }}>
        {/* Isolated container to prevent React DOM errors when YT replaces the child */}
        <div style={{ width: "100%", height: "100%" }}>
          <div id={playerContainerId} style={{ width: "100%", height: "100%" }} />
        </div>

        {/* Empty-state overlay */}
        {!currentSong && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              background: "linear-gradient(135deg, #0b0f16 0%, #111823 100%)",
            }}
          >
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "rgba(163,190,140,0.07)",
              border: "1px solid rgba(163,190,140,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(163,190,140,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#eceff4" }}>Nothing playing</p>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7a8d" }}>
                {isOwner ? "Add a song to the queue to get started" : "Waiting for the host to start music"}
              </p>
            </div>
          </div>
        )}

        {/* Buffering spinner */}
        {buffering && currentSong && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <svg className="animate-spin" width="36" height="36" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <path d="M12 2A10 10 0 0 1 22 12" stroke="#a3be8c" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      {/* ── Now-playing info + owner controls ──────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: "16px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(13,17,23,0.95)",
        }}
      >
        {/* Song info */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isOwner ? 16 : 0 }}>
          {currentSong?.thumbnail && (
            <img src={currentSong.thumbnail} alt="" width={44} height={33}
              style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: 14, fontWeight: 600, color: "#eceff4",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {currentSong?.title ?? "—"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7a8d" }}>
              {currentSong ? `${fmtSec(currentSec)} / ${fmtSec(duration || currentSong.durationMs / 1000)}` : "No track loaded"}
            </p>
          </div>
        </div>

        {/* Owner-only controls */}
        {isOwner && (
          <>
            {/* Seek bar */}
            <div style={{ marginBottom: 14, position: "relative" }}>
              <div style={{ position: "relative", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", cursor: "pointer" }}>
                {/* Filled track */}
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${progress * 100}%`,
                  borderRadius: 2,
                  background: "linear-gradient(90deg, #a3be8c, #8faa78)",
                  pointerEvents: "none",
                }} />
                {/* Thumb */}
                <div style={{
                  position: "absolute",
                  left: `${progress * 100}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 12, height: 12, borderRadius: "50%",
                  background: "#a3be8c",
                  boxShadow: "0 0 0 3px rgba(163,190,140,0.25)",
                  pointerEvents: "none",
                  transition: isDragging ? "none" : "left 0.1s",
                }} />
                {/* Invisible full-width range input on top */}
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.5}
                  value={displaySec}
                  onChange={(e) => { setDragSec(Number(e.target.value)); }}
                  onMouseDown={() => setIsDragging(true)}
                  onTouchStart={() => setIsDragging(true)}
                  onMouseUp={(e) => { setIsDragging(false); handleSeekCommit(Number((e.target as HTMLInputElement).value)); }}
                  onTouchEnd={(e) => { setIsDragging(false); handleSeekCommit(Number((e.target as HTMLInputElement).value)); }}
                  style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    opacity: 0, cursor: "pointer", margin: 0,
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <span style={{ fontSize: 10, color: "#6b7a8d" }}>{fmtSec(displaySec)}</span>
                <span style={{ fontSize: 10, color: "#6b7a8d" }}>{fmtSec(duration)}</span>
              </div>
            </div>

            {/* Playback buttons */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              {/* Play / Pause */}
              <button
                onClick={handlePlayPause}
                disabled={!currentSong}
                style={{
                  width: 48, height: 48, borderRadius: "50%",
                  border: "none",
                  background: currentSong ? "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)" : "rgba(255,255,255,0.06)",
                  color: "#0f1117",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: currentSong ? "pointer" : "not-allowed",
                  transition: "transform 0.12s, opacity 0.12s",
                  flexShrink: 0,
                  boxShadow: currentSong ? "0 4px 16px rgba(163,190,140,0.3)" : "none",
                }}
                onMouseEnter={(e) => { if (currentSong) (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              >
                {isPlaying ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>

              {/* Skip */}
              <button
                onClick={onSkip}
                disabled={!currentSong}
                title="Skip to next"
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  color: currentSong ? "#d8dee9" : "#3d4550",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: currentSong ? "pointer" : "not-allowed",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { if (currentSong) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 4 15 12 5 20 5 4" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
