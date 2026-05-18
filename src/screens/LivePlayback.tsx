import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { useQuery } from '@tanstack/react-query';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { extractTwitchHls } from '../lib/api/twitch';

interface Props {
  /** Twitch channel name. We always use "giantbomb" for now but pass it
   * explicitly so this screen stays generic. */
  channel: string;
  /** Fallback title from the upcoming feed, shown until Twitch returns its
   * own stream title (which usually carries the actual show name). */
  fallbackTitle: string;
  onBack: () => void;
}

export function LivePlayback({ channel, fallbackTitle, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { ref, focusKey } = useFocusable({ focusKey: 'live-root' });

  const stream = useQuery({
    queryKey: ['twitch-hls', channel],
    queryFn: () => extractTwitchHls(channel),
    // Tokens expire after a while, so refetch on a long interval if the
    // screen stays open across an outage.
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    const info = stream.data;
    const el = videoRef.current;
    if (!info || !el) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setError(null);
    if (Hls.isSupported()) {
      const hls = new Hls({
        liveSyncDurationCount: 3,
        maxLiveSyncPlaybackRate: 1.5,
      });
      hls.loadSource(info.hlsUrl);
      hls.attachMedia(el);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setError(`Playback error: ${data.details}`);
      });
      hlsRef.current = hls;
    } else {
      // Safari and some webOS builds play HLS natively.
      el.src = info.hlsUrl;
    }
    const onMeta = () => {
      el.play().catch(() => undefined);
    };
    el.addEventListener('loadedmetadata', onMeta, { once: true });
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
    };
  }, [stream.data]);

  useEffect(() => {
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, []);

  useEffect(() => {
    setFocus('live-back-btn');
  }, []);

  useEffect(() => {
    if (!showOverlay) return;
    const t = window.setTimeout(() => setShowOverlay(false), 4000);
    return () => window.clearTimeout(t);
  }, [showOverlay]);

  function flashOverlay() {
    setShowOverlay(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key;
      if (k === 'Escape' || k === 'XF86Back' || (e as any).keyCode === 461) {
        e.preventDefault();
        onBack();
        return;
      }
      const el = videoRef.current;
      if (!el) return;
      if (k === ' ' || k === 'MediaPlayPause' || (e as any).keyCode === 463) {
        e.preventDefault();
        if (el.paused) el.play().catch(() => undefined);
        else el.pause();
        flashOverlay();
      } else if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'Enter') {
        flashOverlay();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const title =
    stream.data?.title?.trim() ||
    fallbackTitle.trim() ||
    'Giant Bomb Live';

  const loading = stream.isLoading;
  const failed = !loading && (stream.isError || stream.data === null);

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="live" onMouseMove={flashOverlay}>
        <video ref={videoRef} className="live-video" onClick={flashOverlay} />

        {loading && <div className="live-status">Connecting to {channel}...</div>}
        {error && <div className="live-status err">{error}</div>}
        {failed && (
          <div className="live-status err">
            Couldn't reach the live stream. Twitch may be blocking the request,
            or the stream just ended.
          </div>
        )}

        {showOverlay && (
          <div className="live-overlay">
            <div className="live-overlay-top">
              <div className="live-badge">
                <span className="dot" />
                LIVE
              </div>
              <div className="live-title">{title}</div>
            </div>
            <div className="live-overlay-bottom">
              <BackButton onPress={onBack} />
            </div>
          </div>
        )}

        <style>{`
          .live {
            position: fixed;
            inset: 0;
            background: black;
            z-index: 200;
          }
          .live-video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            background: black;
          }
          .live-status {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 4rem;
            text-align: center;
            color: white;
            font-size: 1.4rem;
            opacity: 0.85;
            pointer-events: none;
          }
          .live-status.err { color: #ff8a8a; }
          .live-overlay {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 3rem 4rem;
            background: linear-gradient(
              to bottom,
              rgba(0, 0, 0, 0.65) 0%,
              rgba(0, 0, 0, 0) 30%,
              rgba(0, 0, 0, 0) 70%,
              rgba(0, 0, 0, 0.75) 100%
            );
            pointer-events: none;
          }
          .live-overlay > * { pointer-events: auto; }
          .live-overlay-top {
            display: flex;
            align-items: center;
            gap: 1rem;
          }
          .live-badge {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            background: #cc0000;
            color: white;
            padding: 0.3rem 0.75rem;
            font-size: 0.95rem;
            letter-spacing: 0.1em;
            font-weight: 700;
            border-radius: 6px;
          }
          .dot {
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
            animation: pulse 1.6s ease-in-out infinite;
          }
          @keyframes pulse { 50% { opacity: 0.4; } }
          .live-title {
            font-size: 1.6rem;
            font-weight: 600;
          }
          .live-overlay-bottom {
            display: flex;
            justify-content: flex-end;
          }
        `}</style>
      </div>
    </FocusContext.Provider>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { ref, focused } = useFocusable({
    focusKey: 'live-back-btn',
    onEnterPress: onPress,
  });
  return (
    <button
      ref={ref as any}
      className={`live-back focusable ${focused ? 'focused' : ''}`}
      onClick={onPress}
    >
      Back
      <style>{`
        .live-back {
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 0.7rem 1.4rem;
          font-size: 1.05rem;
          border-radius: 6px;
          cursor: pointer;
        }
      `}</style>
    </button>
  );
}
