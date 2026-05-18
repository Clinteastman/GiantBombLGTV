import { useEffect, useState } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Show } from '../lib/api/types';
import { useInView } from '../hooks/useInView';
import { useLongPress } from '../hooks/useLongPress';

interface Props {
  show: Show;
  onSelect: (show: Show) => void;
  onLongPress?: (show: Show) => void;
  focusKey: string;
  /** Show the ★ prefix to indicate this show is pinned. */
  pinned?: boolean;
}

export function ShowCard({ show, onSelect, onLongPress, focusKey, pinned }: Props) {
  // No onEnterPress here: useLongPress takes over Enter handling so a held
  // press routes to the context menu instead of opening the show.
  const { ref, focused } = useFocusable({ focusKey });

  const press = useLongPress({
    focused,
    onShortPress: () => onSelect(show),
    onLongPress: () => onLongPress?.(show),
  });

  const candidates = [show.posterUrl, show.logoUrl].filter(
    (u): u is string => typeof u === 'string' && u.length > 0
  );
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [show.id]);
  const current = idx < candidates.length ? candidates[idx] : undefined;
  const exhausted = idx >= candidates.length;

  const { ref: inViewRef, inView } = useInView<HTMLDivElement>();
  const advance = () => setIdx((i) => i + 1);

  return (
    <div
      ref={ref}
      className={`show-card focusable ${focused ? 'focused' : ''}`}
      onClick={press.onClick}
      onContextMenu={press.onContextMenu}
    >
      <div ref={inViewRef} className="show-thumb">
        {inView && current ? (
          <img
            key={current}
            src={current}
            alt=""
            onError={advance}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth === 0 || img.naturalHeight === 0) advance();
            }}
          />
        ) : inView && exhausted ? (
          <div className="show-fallback">{show.title.slice(0, 1).toUpperCase()}</div>
        ) : null}
        {pinned && <div className="pin-badge">★</div>}
      </div>
      <div className="show-title">
        {pinned ? '★ ' : ''}
        {show.title}
      </div>
      <style>{`
        .show-card {
          width: 24rem;
          flex: 0 0 auto;
          cursor: pointer;
        }
        .show-thumb {
          position: relative;
          aspect-ratio: 16 / 9;
          background: linear-gradient(135deg, #1d1d24, #2a2a35);
          border-radius: 10px;
          overflow: hidden;
        }
        .show-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .show-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          font-size: 3rem;
          opacity: 0.4;
          font-weight: 700;
        }
        .pin-badge {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: rgba(0, 0, 0, 0.7);
          color: #ffcc33;
          width: 1.8rem;
          height: 1.8rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          line-height: 1;
        }
        .show-title {
          margin-top: 0.8rem;
          font-size: 1.25rem;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
