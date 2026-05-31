import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { useQuery } from '@tanstack/react-query';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { createClient } from '../lib/api/giantbomb';
import {
  loadApiKey,
  loadPreferredQuality,
  savePreferredQuality,
  Quality,
} from '../lib/auth/storage';
import { resolveSource } from '../lib/playback/quality';
import { attachHls } from '../lib/playback/hls';
import { isBackKey, isPlayPauseKey } from '../lib/tv/keys';
import { OverlayButton } from '../components/OverlayButton';
import { PlaybackInfo, Video } from '../lib/api/types';

interface Props {
  video: Video;
  onBack: () => void;
}

const QUALITIES: Quality[] = ['auto', '1080', '720', '480', '360'];
const PROGRESS_SYNC_INTERVAL_MS = 10_000;

export function Playback({ video, onBack }: Props) {
  const apiKey = loadApiKey()!;
  const client = useMemo(() => createClient(apiKey), [apiKey]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSyncRef = useRef<number>(0);

  const [quality, setQuality] = useState<Quality>(() => loadPreferredQuality());
  const [showOverlay, setShowOverlay] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { ref, focusKey } = useFocusable({ focusKey: 'playback-root' });

  const playbackQuery = useQuery({
    queryKey: ['playback', video.id],
    queryFn: () => client.getPlayback(video.id),
  });

  // Resume position fetched once when playback metadata arrives.
  const progressQuery = useQuery({
    queryKey: ['progress'],
    queryFn: () => client.getProgress(),
  });
  const resumeAt =
    progressQuery.data?.find((p) => p.videoId === video.id)?.currentTime ?? 0;

  // Set up the player source whenever the playback info or quality changes.
  useEffect(() => {
    const info = playbackQuery.data;
    const el = videoRef.current;
    if (!info || !el) return;

    const resolved = resolveSource(info, quality);
    if (!resolved) {
      setError('No playable source for this video.');
      return;
    }
    setError(null);

    // Tear down any previous HLS attachment.
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const restoreAt = el.currentTime > 0 ? el.currentTime : resumeAt;

    if (resolved.kind === 'hls') {
      hlsRef.current = attachHls({
        el,
        url: resolved.url,
        config: { maxBufferLength: 30 },
        onFatalError: (details) => setError(`Playback error: ${details}`),
      });
    } else {
      el.src = resolved.url;
    }

    const seekAndPlay = () => {
      if (restoreAt > 0 && Math.abs(el.currentTime - restoreAt) > 1) {
        el.currentTime = restoreAt;
      }
      el.play().catch(() => {
        // Autoplay can be blocked in dev. Overlay shows the Play button.
      });
    };
    el.addEventListener('loadedmetadata', seekAndPlay, { once: true });

    return () => {
      el.removeEventListener('loadedmetadata', seekAndPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackQuery.data, quality]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      // Final progress flush.
      const el = videoRef.current;
      if (el && el.duration > 0 && el.currentTime > 0) {
        client
          .saveProgress(video.id, el.currentTime, el.duration)
          .catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic progress sync while playing.
  function onTimeUpdate() {
    const el = videoRef.current;
    if (!el || !el.duration || el.paused) return;
    const now = Date.now();
    if (now - lastSyncRef.current < PROGRESS_SYNC_INTERVAL_MS) return;
    lastSyncRef.current = now;
    client.saveProgress(video.id, el.currentTime, el.duration).catch(() => undefined);
  }

  // Hide overlay after inactivity.
  useEffect(() => {
    if (!showOverlay) return;
    const t = window.setTimeout(() => setShowOverlay(false), 4000);
    return () => window.clearTimeout(t);
  }, [showOverlay]);

  function flashOverlay() {
    setShowOverlay(true);
  }

  // Remote-button handling.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const key = e.key;
      if (isBackKey(e)) {
        e.preventDefault();
        if (pickerOpen) {
          setPickerOpen(false);
        } else {
          onBack();
        }
        return;
      }
      const el = videoRef.current;
      if (!el) return;
      if (isPlayPauseKey(e)) {
        e.preventDefault();
        if (el.paused) el.play().catch(() => undefined);
        else el.pause();
        flashOverlay();
      } else if (key === 'ArrowRight') {
        e.preventDefault();
        el.currentTime = Math.min(el.duration || 0, el.currentTime + 10);
        flashOverlay();
      } else if (key === 'ArrowLeft') {
        e.preventDefault();
        el.currentTime = Math.max(0, el.currentTime - 10);
        flashOverlay();
      } else if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter') {
        flashOverlay();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, pickerOpen]);

  useEffect(() => {
    if (pickerOpen) {
      setFocus(`quality-${quality}`);
    } else {
      setFocus('playback-quality-btn');
    }
  }, [pickerOpen, quality]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="playback" onMouseMove={flashOverlay}>
        <video
          ref={videoRef}
          className="video"
          onTimeUpdate={onTimeUpdate}
          onClick={flashOverlay}
        />

        {(playbackQuery.isLoading || !playbackQuery.data) && !error && (
          <div className="status">Loading...</div>
        )}
        {error && <div className="status error">{error}</div>}

        {showOverlay && (
          <div className="overlay">
            <div className="overlay-top">
              <div className="overlay-title">{video.title}</div>
              {video.showTitle && <div className="overlay-show">{video.showTitle}</div>}
            </div>
            <div className="overlay-bottom">
              <OverlayButton
                focusKey="playback-quality-btn"
                label={`Quality: ${qualityLabel(quality)}`}
                onPress={() => setPickerOpen((v) => !v)}
              />
              <OverlayButton
                focusKey="playback-back-btn"
                label="Back"
                onPress={onBack}
              />
            </div>
          </div>
        )}

        {pickerOpen && (
          <QualityPicker
            current={quality}
            available={availableQualities(playbackQuery.data)}
            onPick={(q) => {
              setQuality(q);
              savePreferredQuality(q);
              setPickerOpen(false);
            }}
            onCancel={() => setPickerOpen(false)}
          />
        )}

        <style>{`
          .playback {
            position: fixed;
            inset: 0;
            background: black;
            z-index: 200;
          }
          .video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            background: black;
          }
          .status {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.5rem;
            opacity: 0.8;
            pointer-events: none;
          }
          .status.error { color: #ff8a8a; }
          .overlay {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 3rem 4rem;
            background: linear-gradient(
              to bottom,
              rgba(0, 0, 0, 0.6) 0%,
              rgba(0, 0, 0, 0) 25%,
              rgba(0, 0, 0, 0) 70%,
              rgba(0, 0, 0, 0.75) 100%
            );
            pointer-events: none;
          }
          .overlay > * { pointer-events: auto; }
          .overlay-title {
            font-size: 1.8rem;
            font-weight: 600;
          }
          .overlay-show {
            font-size: 1.1rem;
            opacity: 0.7;
            margin-top: 0.2rem;
          }
          .overlay-bottom {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
          }
        `}</style>
      </div>
    </FocusContext.Provider>
  );
}

function QualityPicker({
  current,
  available,
  onPick,
  onCancel,
}: {
  current: Quality;
  available: Quality[];
  onPick: (q: Quality) => void;
  onCancel: () => void;
}) {
  const { ref, focusKey } = useFocusable({ focusKey: 'quality-picker' });
  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="picker" onClick={onCancel}>
        <div className="picker-inner" onClick={(e) => e.stopPropagation()}>
          <h3>Quality</h3>
          {available.map((q) => (
            <QualityRow key={q} quality={q} active={q === current} onPress={() => onPick(q)} />
          ))}
        </div>
        <style>{`
          .picker {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 300;
          }
          .picker-inner {
            background: #1a1a22;
            border-radius: 10px;
            padding: 2rem 2.5rem;
            min-width: 18rem;
          }
          .picker-inner h3 {
            margin: 0 0 1rem;
            font-size: 1.3rem;
            opacity: 0.7;
          }
        `}</style>
      </div>
    </FocusContext.Provider>
  );
}

function QualityRow({
  quality,
  active,
  onPress,
}: {
  quality: Quality;
  active: boolean;
  onPress: () => void;
}) {
  const { ref, focused } = useFocusable({
    focusKey: `quality-${quality}`,
    onEnterPress: onPress,
  });
  return (
    <div
      ref={ref}
      className={`row focusable ${focused ? 'focused' : ''}`}
      onClick={onPress}
    >
      <span>{qualityLabel(quality)}</span>
      {active && <span className="check">checkmark</span>}
      <style>{`
        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.85rem 1rem;
          font-size: 1.2rem;
          cursor: pointer;
          border-radius: 6px;
        }
        .check {
          color: #ff6b6b;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}

function qualityLabel(q: Quality): string {
  switch (q) {
    case 'auto':
      return 'Auto (HLS)';
    default:
      return `${q}p`;
  }
}

function availableQualities(info: PlaybackInfo | undefined): Quality[] {
  if (!info) return QUALITIES;
  const heights = new Set(info.mp4s.map((m) => m.height));
  const list: Quality[] = info.hlsUrl ? ['auto'] : [];
  for (const q of QUALITIES) {
    if (q === 'auto') continue;
    if (heights.has(Number(q))) list.push(q);
  }
  return list.length > 0 ? list : QUALITIES;
}
