import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { createClient } from '../lib/api/giantbomb';
import { loadApiKey } from '../lib/auth/storage';
import { Video } from '../lib/api/types';

interface Props {
  video: Video;
  onBack: () => void;
  onWatch: (video: Video) => void;
}

export function Detail({ video, onBack, onWatch }: Props) {
  const apiKey = loadApiKey()!;
  const client = useMemo(() => createClient(apiKey), [apiKey]);
  const queryClient = useQueryClient();

  const { ref, focusKey } = useFocusable({ focusKey: 'detail-root' });

  useEffect(() => {
    setFocus('detail-watch');
  }, [video.id]);

  // Back key (LG remote XF86Back / Esc in dev).
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

  const watchlist = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => client.getWatchlist(),
  });
  const isInWatchlist = !!watchlist.data?.find((v) => v.id === video.id);

  const addMut = useMutation({
    mutationFn: () => client.addToWatchlist(video.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });
  const removeMut = useMutation({
    mutationFn: () => client.removeFromWatchlist(video.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  function toggleWatchlist() {
    if (isInWatchlist) removeMut.mutate();
    else addMut.mutate();
  }

  const dateStr = formatDate(video.publishDate);
  const durStr = formatDuration(video.durationSeconds);

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="detail">
        {video.thumbnailUrl && (
          <div
            className="hero"
            style={{ backgroundImage: `url(${video.thumbnailUrl})` }}
          />
        )}
        <div className="content">
          {video.showTitle && <div className="eyebrow">{video.showTitle}</div>}
          <h1 className="title">{video.title}</h1>
          <div className="meta">
            {dateStr && <span>{dateStr}</span>}
            {durStr && <span>{durStr}</span>}
            {video.premium && <span className="premium-tag">PREMIUM</span>}
            {video.author && <span>by {video.author}</span>}
          </div>
          {video.description && <p className="desc">{video.description}</p>}
          <div className="actions">
            <ActionButton
              focusKey="detail-watch"
              primary
              label="Watch"
              onPress={() => onWatch(video)}
            />
            <ActionButton
              focusKey="detail-watchlist"
              label={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
              disabled={addMut.isPending || removeMut.isPending}
              onPress={toggleWatchlist}
            />
            <ActionButton focusKey="detail-back" label="Back" onPress={onBack} />
          </div>
        </div>
        <style>{`
          .detail {
            position: relative;
            height: 100%;
            overflow: hidden;
            padding: 6rem 4rem 4rem;
          }
          .hero {
            position: absolute;
            inset: 0;
            background-size: cover;
            background-position: center;
            filter: blur(28px) brightness(0.35);
            transform: scale(1.1);
            z-index: 0;
          }
          .content {
            position: relative;
            z-index: 1;
            max-width: 70rem;
          }
          .eyebrow {
            font-size: 1rem;
            color: #ff6b6b;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            margin-bottom: 0.75rem;
          }
          .title {
            font-size: 3.4rem;
            margin: 0 0 1.2rem;
            line-height: 1.15;
          }
          .meta {
            display: flex;
            gap: 1.5rem;
            font-size: 1.05rem;
            opacity: 0.75;
            margin-bottom: 1.75rem;
            flex-wrap: wrap;
          }
          .premium-tag {
            background: #cc0000;
            color: white;
            padding: 0.15rem 0.6rem;
            border-radius: 4px;
            font-size: 0.85rem;
            letter-spacing: 0.08em;
            opacity: 1;
          }
          .desc {
            font-size: 1.2rem;
            line-height: 1.55;
            opacity: 0.9;
            max-width: 60rem;
            margin: 0 0 2.5rem;
            display: -webkit-box;
            -webkit-line-clamp: 5;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .actions {
            display: flex;
            gap: 1rem;
          }
        `}</style>
      </div>
    </FocusContext.Provider>
  );
}

function ActionButton({
  focusKey,
  label,
  onPress,
  primary,
  disabled,
}: {
  focusKey: string;
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => {
      if (!disabled) onPress();
    },
  });
  return (
    <button
      ref={ref as any}
      className={`btn focusable ${focused ? 'focused' : ''} ${primary ? 'btn-primary' : ''}`}
      onClick={() => {
        if (!disabled) onPress();
      }}
      disabled={disabled}
    >
      {label}
      <style>{`
        .btn {
          font-size: 1.2rem;
          padding: 1rem 2rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: inherit;
          border-radius: 8px;
          cursor: pointer;
        }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary {
          background: #cc0000;
          border-color: #cc0000;
        }
      `}</style>
    </button>
  );
}

function formatDate(s: string): string {
  if (!s) return '';
  // Giant Bomb gives "YYYY-MM-DD HH:MM:SS"; just take the date portion.
  const date = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
