import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { createClient } from '../lib/api/giantbomb';
import { loadApiKey, clearApiKey } from '../lib/auth/storage';
import {
  SECTION_ACTIVE_SHOWS,
  SECTION_CONTINUE,
  SECTION_LEGACY,
  SECTION_LIVE,
  SECTION_PINNED,
  SECTION_PREMIUM,
  SECTION_RECENT,
  SECTION_WATCHLIST,
  getHiddenSections,
  getPinnedShowIds,
  getSectionOrder,
  moveSection,
  movePinnedShow,
  toggleHiddenSection,
  togglePinnedShow,
} from '../lib/prefs/browse';
import { ProgressEntry, Show, Video } from '../lib/api/types';
import { VideoCard } from '../components/VideoCard';
import { UpcomingCard } from '../components/UpcomingCard';
import { ShowCard } from '../components/ShowCard';
import { LazyShowRow } from '../components/LazyShowRow';
import { Row } from '../components/Row';
import { ContextMenu, MenuItem } from '../components/ContextMenu';
import logoUrl from '../assets/logo.png';

interface Props {
  onSelect: (video: Video) => void;
  onSelectShow: (show: Show) => void;
  onSelectLive: (fallbackTitle: string) => void;
  onSearch: () => void;
  onSignOut: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  [SECTION_LIVE]: 'Live & Upcoming',
  [SECTION_CONTINUE]: 'Continue Watching',
  [SECTION_WATCHLIST]: 'Watchlist',
  [SECTION_RECENT]: 'Recent',
  [SECTION_PINNED]: 'Pinned Shows',
  [SECTION_ACTIVE_SHOWS]: 'Shows',
  [SECTION_PREMIUM]: 'Premium Picks',
  [SECTION_LEGACY]: 'Legacy Shows',
};

type MenuKind =
  | { kind: 'section'; id: string }
  | { kind: 'show'; show: Show; ctx: 'pinned' | 'active' | 'legacy' }
  | { kind: 'unhide' };

export function Browse({
  onSelect,
  onSelectShow,
  onSelectLive,
  onSearch,
  onSignOut,
}: Props) {
  const apiKey = loadApiKey()!;
  const client = useMemo(() => createClient(apiKey), [apiKey]);

  const { ref, focusKey } = useFocusable({ focusKey: 'browse-root' });

  useEffect(() => {
    setFocus('header-search');
  }, []);

  // Prefs mirrored in component state so mutations re-render.
  const [pinnedIds, setPinnedIds] = useState<number[]>(() => getPinnedShowIds());
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => getSectionOrder());
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(() => getHiddenSections());

  function refreshPrefs() {
    setPinnedIds(getPinnedShowIds());
    setSectionOrder(getSectionOrder());
    setHiddenSections(getHiddenSections());
  }

  // Data
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

  const { activeShows, legacyShows, pinnedShows } = useMemo(() => {
    const list = shows.data ?? [];
    const byId = new Map(list.map((s) => [s.id, s]));
    return {
      activeShows: list.filter((s) => s.active),
      legacyShows: list.filter((s) => !s.active),
      pinnedShows: pinnedIds.map((id) => byId.get(id)).filter((s): s is Show => !!s),
    };
  }, [shows.data, pinnedIds]);

  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  // Single piece of state for any open menu.
  const [menu, setMenu] = useState<MenuKind | null>(null);
  const openSectionMenu = useCallback(
    (id: string) => setMenu({ kind: 'section', id }),
    []
  );
  const openShowMenu = useCallback(
    (show: Show, ctx: 'pinned' | 'active' | 'legacy') =>
      setMenu({ kind: 'show', show, ctx }),
    []
  );
  const closeMenu = useCallback(() => setMenu(null), []);

  // ---- Menu item builders ---------------------------------------------------

  const sectionMenuItems = useMemo<MenuItem[]>(() => {
    if (menu?.kind !== 'section') return [];
    const id = menu.id;
    // Gate on the visible index: moveSection now reorders relative to the
    // nearest visible neighbor, so hidden rows must be ignored here too.
    const visibleOrder = sectionOrder.filter((s) => !hiddenSections.has(s));
    const vIdx = visibleOrder.indexOf(id);
    const items: MenuItem[] = [
      {
        label: 'Move up',
        disabled: vIdx <= 0,
        onSelect: () => {
          moveSection(id, -1, hiddenSections);
          refreshPrefs();
        },
      },
      {
        label: 'Move down',
        disabled: vIdx < 0 || vIdx >= visibleOrder.length - 1,
        onSelect: () => {
          moveSection(id, +1, hiddenSections);
          refreshPrefs();
        },
      },
      {
        label: 'Hide row',
        onSelect: () => {
          toggleHiddenSection(id);
          refreshPrefs();
        },
      },
    ];
    return items;
  }, [menu, sectionOrder, hiddenSections]);

  const showMenuItems = useMemo<MenuItem[]>(() => {
    if (menu?.kind !== 'show') return [];
    const { show, ctx } = menu;
    const isPinned = pinnedSet.has(show.id);
    const items: MenuItem[] = [];
    items.push({
      label: isPinned ? 'Unpin' : 'Pin to top',
      onSelect: () => {
        togglePinnedShow(show.id);
        refreshPrefs();
      },
    });
    if (isPinned) {
      // Gate on the visible pinned order (pinnedShows), not the raw id list:
      // pinnedIds can contain shows outside the capped getShows() window that
      // never render, and acting on those is invisible to the user. The set of
      // such unrenderable ids is passed to movePinnedShow so it hops over them.
      const visibleIds = new Set(pinnedShows.map((s) => s.id));
      const hiddenPinned = new Set(pinnedIds.filter((id) => !visibleIds.has(id)));
      const vIdx = pinnedShows.findIndex((s) => s.id === show.id);
      items.push({
        label: 'Move pinned up',
        disabled: vIdx <= 0,
        onSelect: () => {
          movePinnedShow(show.id, -1, hiddenPinned);
          refreshPrefs();
        },
      });
      items.push({
        label: 'Move pinned down',
        disabled: vIdx < 0 || vIdx >= pinnedShows.length - 1,
        onSelect: () => {
          movePinnedShow(show.id, +1, hiddenPinned);
          refreshPrefs();
        },
      });
    }
    items.push({
      label: 'Open show',
      onSelect: () => onSelectShow(show),
    });
    // Section-level reorder for the parent grid the show lives in.
    const sectionId = ctx === 'legacy' ? SECTION_LEGACY : SECTION_ACTIVE_SHOWS;
    items.push({
      label: `Customize ${SECTION_LABELS[sectionId]} row...`,
      onSelect: () => setMenu({ kind: 'section', id: sectionId }),
    });
    return items;
  }, [menu, pinnedSet, pinnedIds, pinnedShows, onSelectShow]);

  const unhideMenuItems = useMemo<MenuItem[]>(() => {
    return Array.from(hiddenSections).map((id) => ({
      label: `Show ${SECTION_LABELS[id] ?? id}`,
      onSelect: () => {
        toggleHiddenSection(id);
        refreshPrefs();
      },
    }));
  }, [hiddenSections]);

  // ---- Section dispatcher ---------------------------------------------------

  function renderSection(id: string) {
    if (hiddenSections.has(id)) return null;
    const menuFor = () => openSectionMenu(id);
    switch (id) {
      case SECTION_LIVE:
        if (upcomingItems.length === 0) return null;
        return (
          <Row title={SECTION_LABELS[id]} focusKey="row-upcoming" onTitleMenu={menuFor}>
            {upcomingItems.map((item, i) => (
              <UpcomingCard
                key={`${item.title}-${i}`}
                item={item}
                focusKey={`upcoming-${i}`}
                onLongPress={menuFor}
                onSelect={(picked) => {
                  if (picked.isLive) {
                    onSelectLive(picked.title);
                  } else {
                    alert(`"${picked.title}" hasn't started yet.`);
                  }
                }}
              />
            ))}
          </Row>
        );
      case SECTION_CONTINUE:
        if (!continueWatching.data || continueWatching.data.length === 0) return null;
        return (
          <Row title={SECTION_LABELS[id]} focusKey="row-continue" onTitleMenu={menuFor}>
            {continueWatching.data.map(({ video, progress: p }) => (
              <VideoCard
                key={video.id}
                video={video}
                onSelect={onSelect}
                onLongPress={menuFor}
                progress={p}
                focusKey={`continue-${video.id}`}
              />
            ))}
          </Row>
        );
      case SECTION_WATCHLIST:
        if (!watchlist.data || watchlist.data.length === 0) return null;
        return (
          <Row title={SECTION_LABELS[id]} focusKey="row-watchlist" onTitleMenu={menuFor}>
            {watchlist.data.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onSelect={onSelect}
                onLongPress={menuFor}
                focusKey={`watchlist-${v.id}`}
              />
            ))}
          </Row>
        );
      case SECTION_RECENT:
        return (
          <Row title={SECTION_LABELS[id]} focusKey="row-recent" onTitleMenu={menuFor}>
            {recent.isLoading && <Placeholder count={6} />}
            {recent.data?.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onSelect={onSelect}
                onLongPress={menuFor}
                focusKey={`recent-${v.id}`}
              />
            ))}
            {recent.isError && <ErrorBanner message={errMsg(recent.error)} />}
          </Row>
        );
      case SECTION_PINNED:
        if (pinnedShows.length === 0) return null;
        return pinnedShows.map((s) => (
          <LazyShowRow
            key={`pinned-row-${s.id}`}
            show={s}
            onSelect={onSelect}
            title={`★ ${s.title}`}
            focusKey={`pinned-row-${s.id}`}
            onTitleMenu={(show) => openShowMenu(show, 'pinned')}
          />
        ));
      case SECTION_ACTIVE_SHOWS:
        if (activeShows.length === 0) return null;
        return (
          <>
            <Row title="Browse Shows" focusKey="row-browse-shows" onTitleMenu={menuFor}>
              {[
                ...pinnedShows.filter((s) => s.active),
                ...activeShows.filter((s) => !pinnedSet.has(s.id)),
              ].map((s) => (
                <ShowCard
                  key={s.id}
                  show={s}
                  onSelect={onSelectShow}
                  onLongPress={(show) => openShowMenu(show, 'active')}
                  focusKey={`browse-show-${s.id}`}
                  pinned={pinnedSet.has(s.id)}
                />
              ))}
            </Row>
            {activeShows
              .filter((s) => !pinnedSet.has(s.id))
              .map((s) => (
                <LazyShowRow
                  key={`show-row-${s.id}`}
                  show={s}
                  onSelect={onSelect}
                  title={`☆ ${s.title}`}
                  onTitleMenu={(show) => openShowMenu(show, 'active')}
                />
              ))}
          </>
        );
      case SECTION_PREMIUM:
        return (
          <Row title={SECTION_LABELS[id]} focusKey="row-premium" onTitleMenu={menuFor}>
            {premium.isLoading && <Placeholder count={6} />}
            {premium.data?.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onSelect={onSelect}
                onLongPress={menuFor}
                focusKey={`premium-${v.id}`}
              />
            ))}
          </Row>
        );
      case SECTION_LEGACY:
        if (legacyShows.length === 0) return null;
        return (
          <Row title={SECTION_LABELS[id]} focusKey="row-legacy-shows" onTitleMenu={menuFor}>
            {[
              ...pinnedShows.filter((s) => !s.active),
              ...legacyShows.filter((s) => !pinnedSet.has(s.id)),
            ].map((s) => (
              <ShowCard
                key={s.id}
                show={s}
                onSelect={onSelectShow}
                onLongPress={(show) => openShowMenu(show, 'legacy')}
                focusKey={`legacy-show-${s.id}`}
                pinned={pinnedSet.has(s.id)}
              />
            ))}
          </Row>
        );
      default:
        return null;
    }
  }

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
            {hiddenSections.size > 0 && (
              <HeaderButton
                focusKey="header-hidden"
                label={`Hidden (${hiddenSections.size})`}
                onPress={() => setMenu({ kind: 'unhide' })}
              />
            )}
            <HeaderButton focusKey="header-search" label="Search" onPress={onSearch} />
            <HeaderButton focusKey="header-signout" label="Sign out" onPress={handleSignOut} />
          </div>
        </header>

        <div className="rows">
          {sectionOrder.map((id) => (
            <Fragment key={id}>{renderSection(id)}</Fragment>
          ))}
        </div>

        {menu?.kind === 'section' && (
          <ContextMenu
            title={SECTION_LABELS[menu.id] ?? menu.id}
            items={sectionMenuItems}
            onClose={closeMenu}
          />
        )}
        {menu?.kind === 'show' && (
          <ContextMenu
            title={menu.show.title}
            items={showMenuItems}
            onClose={closeMenu}
          />
        )}
        {menu?.kind === 'unhide' && (
          <ContextMenu
            title="Hidden rows"
            items={
              unhideMenuItems.length > 0
                ? unhideMenuItems
                : [{ label: 'No hidden rows', onSelect: () => undefined, disabled: true }]
            }
            onClose={closeMenu}
          />
        )}

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
