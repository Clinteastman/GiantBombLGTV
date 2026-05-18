import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '../lib/api/giantbomb';
import { loadApiKey } from '../lib/auth/storage';
import { Show, Video } from '../lib/api/types';
import { VideoCard } from './VideoCard';
import { Row } from './Row';

interface Props {
  show: Show;
  onSelect: (video: Video) => void;
  /** Optional title override, e.g. "★ Show Title" for pinned shows. */
  title?: string;
  /** Long-press / right-click handler for the row title. */
  onTitleMenu?: (show: Show) => void;
  /** Custom focusKey suffix when the same show appears in multiple rows
   * (e.g. once in Pinned and once in active_shows). */
  focusKey?: string;
}

/**
 * A per-show row whose videos are only fetched once the row scrolls near
 * the viewport. Without this, rendering rows for every active show
 * (often 30+) would fire 30+ /api/public/videos requests at once and trip
 * Giant Bomb's rate limit.
 */
export function LazyShowRow({
  show,
  onSelect,
  title,
  onTitleMenu,
  focusKey,
}: Props) {
  const apiKey = loadApiKey()!;
  const client = useMemo(() => createClient(apiKey), [apiKey]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [shouldFetch, setShouldFetch] = useState(false);

  useEffect(() => {
    if (shouldFetch || !wrapperRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShouldFetch(true);
          obs.disconnect();
        }
      },
      { rootMargin: '400px 0px' }
    );
    obs.observe(wrapperRef.current);
    return () => obs.disconnect();
  }, [shouldFetch]);

  const videos = useQuery({
    queryKey: ['show-videos', show.id],
    queryFn: () => client.getVideos({ showId: show.id, limit: 20 }),
    enabled: shouldFetch,
    staleTime: 5 * 60_000,
  });

  const rowFocusKey = focusKey ?? `lazy-show-${show.id}`;

  return (
    <div ref={wrapperRef}>
      <Row
        title={title ?? show.title}
        focusKey={rowFocusKey}
        onTitleMenu={onTitleMenu ? () => onTitleMenu(show) : undefined}
      >
        {!shouldFetch || videos.isLoading ? (
          <RowPlaceholder count={5} />
        ) : (
          videos.data?.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              onSelect={onSelect}
              focusKey={`${rowFocusKey}-video-${v.id}`}
            />
          ))
        )}
        {videos.isError && (
          <div className="lzr-err">
            Couldn't load. Will retry on next visit.
            <style>{`.lzr-err { padding: 1rem; color: #ff8a8a; }`}</style>
          </div>
        )}
      </Row>
    </div>
  );
}

function RowPlaceholder({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="lzr-ph">
          <style>{`
            .lzr-ph {
              width: 26rem;
              aspect-ratio: 16 / 9;
              background: linear-gradient(90deg, #1a1a21, #23232c, #1a1a21);
              border-radius: 10px;
              flex: 0 0 auto;
              animation: pulse 1.4s ease-in-out infinite;
            }
            @keyframes pulse { 50% { opacity: 0.5; } }
          `}</style>
        </div>
      ))}
    </>
  );
}
