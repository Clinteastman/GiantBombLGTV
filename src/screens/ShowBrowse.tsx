import { useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { createClient } from '../lib/api/giantbomb';
import { loadApiKey } from '../lib/auth/storage';
import { Show, Video } from '../lib/api/types';
import { VideoCard } from '../components/VideoCard';

interface Props {
  show: Show;
  onSelect: (video: Video) => void;
  onBack: () => void;
}

const PAGE_SIZE = 40;

export function ShowBrowse({ show, onSelect, onBack }: Props) {
  const apiKey = loadApiKey()!;
  const client = useMemo(() => createClient(apiKey), [apiKey]);

  const { ref, focusKey } = useFocusable({ focusKey: 'show-browse-root' });

  useEffect(() => {
    setFocus('show-back');
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'XF86Back' || (e as any).keyCode === 461) {
        e.preventDefault();
        onBack();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const query = useInfiniteQuery({
    queryKey: ['show-browse', show.id],
    queryFn: ({ pageParam }) =>
      client.getVideos({ showId: show.id, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, all) =>
      lastPage.length < PAGE_SIZE ? undefined : all.length * PAGE_SIZE,
  });

  const videos = query.data?.pages.flat() ?? [];

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="sb">
        <header className="sb-header">
          <BackButton onPress={onBack} />
          <div className="sb-title">
            <h1>{show.title}</h1>
            {show.deck && <p>{show.deck}</p>}
          </div>
        </header>

        {query.isLoading && <div className="sb-hint">Loading...</div>}
        {query.isError && (
          <div className="sb-hint err">{errMsg(query.error)}</div>
        )}

        {videos.length > 0 && (
          <Grid
            videos={videos}
            onSelect={onSelect}
            onReachEnd={() => {
              if (query.hasNextPage && !query.isFetchingNextPage) {
                query.fetchNextPage();
              }
            }}
          />
        )}

        {query.isFetchingNextPage && <div className="sb-hint">Loading more...</div>}

        <style>{`
          .sb {
            height: 100%;
            overflow-y: auto;
            scrollbar-width: none;
            padding: 0 4rem 3rem;
          }
          .sb::-webkit-scrollbar { display: none; }
          .sb-header {
            display: flex;
            align-items: flex-start;
            gap: 1.5rem;
            padding: 2rem 0 1.5rem;
          }
          .sb-title h1 {
            margin: 0 0 0.4rem;
            font-size: 2.4rem;
          }
          .sb-title p {
            margin: 0;
            opacity: 0.7;
            font-size: 1.1rem;
            max-width: 60rem;
          }
          .sb-hint {
            padding: 1.5rem 0;
            opacity: 0.65;
            font-size: 1.1rem;
          }
          .sb-hint.err { color: #ff8a8a; opacity: 1; }
        `}</style>
      </div>
    </FocusContext.Provider>
  );
}

function Grid({
  videos,
  onSelect,
  onReachEnd,
}: {
  videos: Video[];
  onSelect: (v: Video) => void;
  onReachEnd: () => void;
}) {
  const { ref, focusKey } = useFocusable({ focusKey: 'show-grid' });

  // Trigger pagination when the last row is in view.
  useEffect(() => {
    const el = document.querySelector('.sb-grid-sentinel');
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) onReachEnd();
    }, { rootMargin: '300px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [videos.length, onReachEnd]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="sb-grid">
        {videos.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            onSelect={onSelect}
            focusKey={`show-grid-${v.id}`}
          />
        ))}
        <div className="sb-grid-sentinel" />
        <style>{`
          .sb-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(26rem, 1fr));
            gap: 1.75rem 1.25rem;
          }
          .sb-grid-sentinel {
            grid-column: 1 / -1;
            height: 1px;
          }
        `}</style>
      </div>
    </FocusContext.Provider>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { ref, focused } = useFocusable({
    focusKey: 'show-back',
    onEnterPress: onPress,
  });
  return (
    <button
      ref={ref as any}
      className={`sb-back focusable ${focused ? 'focused' : ''}`}
      onClick={onPress}
    >
      Back
      <style>{`
        .sb-back {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: inherit;
          padding: 0.7rem 1.4rem;
          font-size: 1.05rem;
          border-radius: 6px;
          cursor: pointer;
        }
      `}</style>
    </button>
  );
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}
