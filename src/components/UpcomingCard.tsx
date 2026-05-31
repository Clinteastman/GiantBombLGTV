import { useEffect, useState } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { UpcomingStream } from '../lib/api/types';
import { useInView } from '../hooks/useInView';
import { useLongPress } from '../hooks/useLongPress';

interface Props {
  item: UpcomingStream;
  focusKey: string;
  onSelect?: (item: UpcomingStream) => void;
  /** Long-press / right-click handler. When set, a held press opens this menu
   * (Browse uses it to surface the Live & Upcoming row actions, since the row
   * title is no longer a focusable spatial-nav target). */
  onLongPress?: (item: UpcomingStream) => void;
}

export function UpcomingCard({ item, focusKey, onSelect, onLongPress }: Props) {
  const hasLongPress = !!onLongPress;
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: hasLongPress ? undefined : () => onSelect?.(item),
  });

  const press = useLongPress({
    focused: focused && hasLongPress,
    onShortPress: () => onSelect?.(item),
    onLongPress: () => onLongPress?.(item),
  });

  const when = formatWhen(item.date, item.isLive);
  const [imgBroken, setImgBroken] = useState(false);
  useEffect(() => setImgBroken(false), [item.image]);
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`up-card focusable ${focused ? 'focused' : ''}`}
      onClick={press.onClick}
      onContextMenu={hasLongPress ? press.onContextMenu : undefined}
    >
      <div ref={inViewRef} className="up-thumb">
        {inView && item.image && !imgBroken ? (
          <img
            src={item.image}
            alt=""
            onError={() => setImgBroken(true)}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth === 0 || img.naturalHeight === 0) setImgBroken(true);
            }}
          />
        ) : inView ? (
          <div className="up-fallback">{item.type || 'Show'}</div>
        ) : null}
        {item.isLive && (
          <div className="live-badge">
            <span className="dot" />
            LIVE
          </div>
        )}
        {item.premium && !item.isLive && <div className="premium-badge">PREMIUM</div>}
      </div>
      <div className="up-title">{item.title}</div>
      <div className="up-when">{when}</div>
      <style>{`
        .up-card {
          width: 26rem;
          flex: 0 0 auto;
          cursor: pointer;
        }
        .up-thumb {
          position: relative;
          aspect-ratio: 16 / 9;
          background: linear-gradient(135deg, #1a1a21, #23232c);
          border-radius: 10px;
          overflow: hidden;
        }
        .up-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .up-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          opacity: 0.45;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .live-badge {
          position: absolute;
          top: 0.5rem;
          left: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          background: #cc0000;
          color: white;
          padding: 0.2rem 0.55rem;
          font-size: 0.8rem;
          letter-spacing: 0.1em;
          border-radius: 4px;
          font-weight: 700;
        }
        .dot {
          width: 6px;
          height: 6px;
          background: white;
          border-radius: 50%;
          animation: pulse 1.6s ease-in-out infinite;
        }
        @keyframes pulse { 50% { opacity: 0.4; } }
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
        .up-title {
          margin-top: 0.8rem;
          font-size: 1.3rem;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .up-when {
          margin-top: 0.35rem;
          font-size: 1.1rem;
          opacity: 0.65;
        }
      `}</style>
    </div>
  );
}

function formatWhen(raw: string, isLive?: boolean): string {
  if (isLive) return 'Live now';
  if (!raw) return '';
  const t = Date.parse(raw.replace(' ', 'T'));
  if (Number.isNaN(t)) return raw;
  const d = new Date(t);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
