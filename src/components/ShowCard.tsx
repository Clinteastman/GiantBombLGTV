import { useEffect, useState } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { Show } from '../lib/api/types';
import { useInView } from '../hooks/useInView';

interface Props {
  show: Show;
  onSelect: (show: Show) => void;
  focusKey: string;
}

export function ShowCard({ show, onSelect, focusKey }: Props) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onSelect(show),
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
      onClick={() => onSelect(show)}
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
      </div>
      <div className="show-title">{show.title}</div>
      <style>{`
        .show-card {
          width: 24rem;
          flex: 0 0 auto;
          cursor: pointer;
        }
        .show-thumb {
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
