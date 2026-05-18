import { useEffect, useState } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Video } from '../lib/api/types';
import { useInView } from '../hooks/useInView';

interface Props {
  video: Video;
  onSelect: (video: Video) => void;
  /** Progress as a fraction 0..1. If > 0, a red bar overlays the thumbnail. */
  progress?: number;
  /** Unique focus key. Defaults to `video-{id}`; pass when the same video can
   * appear in more than one row so each instance is independently focusable. */
  focusKey?: string;
}

export function VideoCard({ video, onSelect, progress, focusKey }: Props) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onSelect(video),
    focusKey: focusKey ?? `video-${video.id}`,
  });

  const duration = formatDuration(video.durationSeconds);
  const pct = progress != null ? Math.max(0, Math.min(1, progress)) * 100 : 0;

  const candidates =
    video.thumbnailCandidates.length > 0
      ? video.thumbnailCandidates
      : video.thumbnailUrl
      ? [video.thumbnailUrl]
      : [];
  const [thumbIdx, setThumbIdx] = useState(0);
  useEffect(() => setThumbIdx(0), [video.id]);
  const currentThumb = thumbIdx < candidates.length ? candidates[thumbIdx] : undefined;
  const exhausted = thumbIdx >= candidates.length;

  const { ref: inViewRef, inView } = useInView<HTMLDivElement>();

  function advance() {
    setThumbIdx((i) => i + 1);
  }

  return (
    <div
      ref={ref}
      className={`card focusable ${focused ? 'focused' : ''}`}
      onClick={() => onSelect(video)}
    >
      <div ref={inViewRef} className="thumb">
        {inView && currentThumb ? (
          <img
            key={currentThumb}
            src={currentThumb}
            alt=""
            onError={advance}
            onLoad={(e) => {
              // 200 OK + empty/junk payload: browser reports naturalWidth 0,
              // doesn't fire onError. Treat as broken and fall through.
              const img = e.currentTarget;
              if (img.naturalWidth === 0 || img.naturalHeight === 0) advance();
            }}
          />
        ) : inView && exhausted ? (
          <ThumbFallback label={video.showTitle ?? 'Giant Bomb'} />
        ) : null}
        {video.premium && <div className="premium-badge">PREMIUM</div>}
        {pct > 0 && (
          <div className="progress">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="card-title">{video.title}</div>
      {(video.showTitle || duration) && (
        <div className="card-meta">
          <span className="card-show">{video.showTitle ?? ''}</span>
          {duration && <span className="card-runtime">{duration}</span>}
        </div>
      )}
      <style>{`
        .card {
          width: 26rem;
          flex: 0 0 auto;
          cursor: pointer;
        }
        .thumb {
          position: relative;
          aspect-ratio: 16 / 9;
          background: linear-gradient(135deg, #1a1a21, #23232c);
          border-radius: 10px;
          overflow: hidden;
        }
        .thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .premium-badge {
          position: absolute;
          top: 0.5rem;
          left: 0.5rem;
          background: #cc0000;
          color: white;
          padding: 0.2rem 0.5rem;
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          border-radius: 4px;
        }
        .progress {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
        }
        .progress-fill {
          height: 100%;
          background: #ff3b30;
        }
        .card-title {
          margin-top: 0.8rem;
          font-size: 1.3rem;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .card-meta {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 0.75rem;
          margin-top: 0.35rem;
          font-size: 1.1rem;
          opacity: 0.6;
        }
        .card-show {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .card-runtime {
          flex-shrink: 0;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}

function ThumbFallback({ label }: { label: string }) {
  return (
    <div className="thumb-fallback">
      <span>{label}</span>
      <style>{`
        .thumb-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 0 1rem;
          text-align: center;
          font-size: 1.05rem;
          opacity: 0.55;
          letter-spacing: 0.02em;
          background:
            radial-gradient(circle at 50% 40%, rgba(255,255,255,0.04), transparent 60%),
            linear-gradient(135deg, #1a1a21, #23232c);
        }
      `}</style>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
