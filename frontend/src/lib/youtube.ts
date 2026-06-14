"use client";

/**
 * Shared YouTube IFrame API loader.
 * Module-level state ensures the <script> tag is only injected once,
 * even if multiple components call ensureYTApi simultaneously.
 */

let _ready = false;
const _pending: Array<() => void> = [];

export function ensureYTApi(cb: () => void): void {
  if (_ready) { cb(); return; }

  _pending.push(cb);

  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      _ready = true;
      _pending.forEach((f) => f());
      _pending.length = 0;
      prev?.(); // Don't stomp other listeners
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
}
