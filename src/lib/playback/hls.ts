import Hls, { HlsConfig } from 'hls.js';

interface AttachOptions {
  el: HTMLVideoElement;
  url: string;
  /** Extra hls.js config merged over the defaults (e.g. live tuning). */
  config?: Partial<HlsConfig>;
  /** Called with `data.details` when hls.js reports a fatal error. */
  onFatalError?: (details: string) => void;
}

/**
 * Attach an HLS source to a <video>. When MSE/hls.js is supported it wires up
 * an Hls instance (returned so the caller can destroy it); otherwise it falls
 * back to native HLS via `el.src` (Safari, some webOS builds) and returns null.
 *
 * Shared by the VOD (Playback) and live (LivePlayback) screens so the setup,
 * fatal-error wiring, and native fallback live in one place.
 */
export function attachHls({
  el,
  url,
  config,
  onFatalError,
}: AttachOptions): Hls | null {
  if (Hls.isSupported()) {
    const hls = new Hls(config);
    hls.loadSource(url);
    hls.attachMedia(el);
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) onFatalError?.(data.details);
    });
    return hls;
  }
  el.src = url;
  return null;
}
