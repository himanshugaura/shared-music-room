/**
 * youtube.ts — YouTube IFrame API types, usable as both:
 *  - an importable interface: `import type { YTPlayer } from "@/types/youtube"`
 *  - a global ambient declaration (via tsconfig includes or triple-slash)
 */

export interface YTPlayer {
  loadVideoById(params: { videoId: string; startSeconds?: number }): void;
  cueVideoById(params: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
  destroy(): void;
}

export interface YTPlayerConfig {
  videoId?: string;
  height?: string | number;
  width?: string | number;
  playerVars?: Record<string, unknown>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: number; target: YTPlayer }) => void;
  };
}

declare global {
  interface Window {
    YT: {
      Player: new (el: string | HTMLElement, cfg: YTPlayerConfig) => YTPlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
