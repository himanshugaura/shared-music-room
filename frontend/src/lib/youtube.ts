"use client";

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
      prev?.();
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  }
}
