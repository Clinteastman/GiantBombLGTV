import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { createClient } from '../lib/api/giantbomb';
import { loadApiKey, clearApiKey } from '../lib/auth/storage';
import { ProgressEntry, Show, Video } from '../lib/api/types';
import { VideoCard } from '../components/VideoCard';
import { UpcomingCard } from '../components/UpcomingCard';
import { ShowCard } from '../components/ShowCard';
import { LazyShowRow } from '../components/LazyShowRow';
import { Row } from '../components/Row';
import logoUrl from '../assets/logo.png';

interface Props {
  onSelect: (video: Video) => void;
  onSelectShow: (show: Show) => void;
  onSearch: () => void;
  onSignOut: () => void;
}

export function Browse({ onSelect, onSelectShow, onSearch, onSignOut }: Props) {
  const apiKey = loadApiKey()!;
  const client = useMemo(() => createClient(apiKey), [apiKey]);

  const { ref, focusKey } = useFocusable({ focusKey: 'browse-root' });

  useEffect(() => {
    setFocus('header-search');
  }, []);

  const recent = useQuery({
    queryKey: ['videos', 'recent'],
    queryFn: () => client.getVideos({ limit: 24 }),
  });

  const premium = useQuery({
    queryKey: ['videos', 'premium'],
    queryFn: () => client.getVideos({ limit: 24, premium: true }),
  });

  const watchlist = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => client.getWatchlist(),
  });

  const progress = useQuery({
    queryKey: ['progress'],
    queryFn: () => client.getProgress(),
  });

  const shows = useQuery({
    queryKey: ['shows'],
    queryFn: () => client.getShows(100),
    staleTime: 10 * 60_000,
  });

  const inProgressEntries = useMemo<ProgressEntry[]>(() => {
    if (!progress.data) return [];
    return progress.data
      .filter((p) => p.percentComplete < 95 && p.currentTime > 30)
      .slice(0, 20);
  }, [progress.data]);

  const continueWatching = useQuery({
    queryKey: ['continueWatching', inProgressEntries.map((p) => p.videoId)],
    queryFn: async () => {
      const videos = await client.getVideosByIds(inProgressEntries.map((p) => p.videoId));
      const byId = new Map(videos.map((v) => [v.id, v]));
      return inProgressEntries
        .map((p) => {
          const v = byId.get(p.videoId);
          if (!v) return null;
          return { video: v, progress: p.currentTime / Math.max(p.duration, 1) };
        })
        .filter(Boolean) as Array<{ video: Video; progress: number }>;
    },
    enabled: inProgressEntries.length > 0,
  });

  const upcoming = useQuery({
    queryKey: ['upcoming'],
    queryFn: () => client.getUpcoming(),
    refetchInterval: 60_000,
  });

  const upcomingItems = useMemo(() => {
    if (!upcoming.data) return [];
    const items = [...upcoming.data.upcoming];
    if (upcoming.data.liveNow) items.unshift(upcoming.data.liveNow);
    return items;
  }, [upcoming.data]);

  const { activeShows, legacyShows } = useMemo(() => {
    const list = shows.data ?? [];
    return {
      activeShows: list.filter((s) => s.active),
      legacyShows: list.filter((s) => !s.active),
    };
  }, [shows.data]);

  function handleSignOut() {
    if (confirm('Sign out and clear your API key?')) {
      clearApiKey();
      onSignOut();
    }
  }

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="browse">
        <header className="browse-header">
          <img className="brand-wordmark" src={logoUrl} alt="Giant Bomb TV" />
          <div className="header-actions">
            <HeaderButton focusKey="header-search" label="Search" onPress={onSearch} />
            <HeaderButton focusKey="header-signout" label="Sign out" onPress={handleSignOut} />
          </div>
        </header>

        <div className="rows">
          {upcomingItems.length > 0 && (
            <Row title="Live & Upcoming" focusKey="row-upcoming">
              {upcomingItems.map((item, i) => (
                <UpcomingCard
                  key={`${item.title}-${i}`}
                  item={item}
                  focusKey={`upcoming-${i}`}
                />
              ))}
            </Row>
          )}

          {continueWatching.data && continueWatching.data.length > 0 && (
            <Row title="Continue Watching" focusKey="row-continue">
              {continueWatching.data.map(({ video, progress: p }) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onSelect={onSelect}
                  progress={p}
                  focusKey={`continue-${video.id}`}
                />
              ))}
            </Row>
          )}

          {watchlist.data && watchlist.data.length > 0 && (
            <Row title="Watchlist" focusKey="row-watchlist">
              {watchlist.data.map((v) => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onSelect={onSelect}
                  focusKey={`watchlist-${v.id}`}
                />
              ))}
            </Row>
          )}

          <Row title="Recent" focusKey="row-recent">
            {recent.isLoading && <Placeholder count={6} />}
            {recent.data?.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onSelect={onSelect}
                focusKey={`recent-${v.id}`}
              />
            ))}
            {recent.isError && <ErrorBanner message={errMsg(recent.error)} />}
          </Row>

          {activeShows.length > 0 && (
            <Row title="Browse Shows" focusKey="row-browse-shows">
              {activeShows.map((s) => (
                <ShowCard
                  key={s.id}
                  show={s}
                  onSelect={onSelectShow}
                  focusKey={`browse-show-${s.id}`}
                />
              ))}
            </Row>
          )}

          {activeShows.map((s) => (
            <LazyShowRow
              key={`show-row-${s.id}`}
              show={s}
              onSelect={onSelect}
              title={`☆ ${s.title}`}
            />
          ))}

          <Row title="Premium Picks" focusKey="row-premium">
            {premium.isLoading && <Placeholder count={6} />}
            {premium.data?.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onSelect={onSelect}
                focusKey={`premium-${v.id}`}
              />
            ))}
          </Row>

          {legacyShows.length > 0 && (
            <Row title="Legacy Shows" focusKey="row-legacy-shows">
              {legacyShows.map((s) => (
                <ShowCard
                  key={s.id}
                  show={s}
                  onSelect={onSelectShow}
                  focusKey={`legacy-show-${s.id}`}
                />
              ))}
            </Row>
          )}
        </div>

        <style>{`
          .browse {
            height: 100%;
            overflow-y: auto;
            scrollbar-width: none;
            padding-bottom: 3rem;
          }
          .browse::-webkit-scrollbar {
            display: none;
          }
          .browse-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 2rem 4rem 1.5rem;
          }
          .brand-wordmark {
            height: 2.6rem;
            width: auto;
            display: block;
          }
          .header-actions {
            display: flex;
            gap: 0.75rem;
          }
          .rows {
            padding-top: 1rem;
          }
        `}</style>
      </div>
    </FocusContext.Provider>
  );
}

function HeaderButton({
  focusKey,
  label,
  onPress,
}: {
  focusKey: string;
  label: string;
  onPress: () => void;
}) {
  const { ref, focused } = useFocusable({ focusKey, onEnterPress: onPress });
  return (
    <button
      ref={ref as any}
      className={`hbtn focusable ${focused ? 'focused' : ''}`}
      onClick={onPress}
    >
      {label}
      <style>{`
        .hbtn {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: inherit;
          padding: 0.6rem 1.2rem;
          font-size: 1rem;
          border-radius: 6px;
          cursor: pointer;
        }
      `}</style>
    </button>
  );
}

function Placeholder({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ph">
          <style>{`
            .ph {
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

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="err">
      {message}
      <style>{`.err { padding: 1rem 1.5rem; color: #ff8a8a; font-size: 1rem; }`}</style>
    </div>
  );
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}
