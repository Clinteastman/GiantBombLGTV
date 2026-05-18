import { UpcomingStream } from '../api/types';
import { LiveStatus } from '../api/twitch';

/**
 * Pure functions for translating /upcoming_json + Twitch live signal into
 * what the UI consumes. Mirrors UpcomingResolver.kt.
 */

/**
 * Reconcile the GB feed's `liveNow` with Twitch's authoritative live signal.
 *   - Twitch unknown (null) → trust the GB feed.
 *   - Twitch live           → keep liveNow but prefer Twitch's title +
 *                              preview image (the GB feed sometimes still
 *                              shows the previous show).
 *   - Twitch offline        → drop liveNow regardless of what the feed says,
 *                              so finished streams stop sticking.
 */
export function resolveLiveNow(
  apiLiveNow: UpcomingStream | null,
  twitchStatus: LiveStatus | null
): UpcomingStream | null {
  if (twitchStatus == null) return apiLiveNow;
  if (!twitchStatus.isLive) return null;

  const base: UpcomingStream = apiLiveNow ?? {
    type: 'live',
    title: '',
    image: null,
    date: '',
    premium: false,
    isLive: true,
  };
  const title =
    (twitchStatus.title && twitchStatus.title.trim()) ||
    (base.title || 'Giant Bomb Live');
  return {
    ...base,
    title,
    image: twitchStatus.previewImageUrl ?? base.image,
    isLive: true,
  };
}

/**
 * Filter retired / duplicated upcoming entries. When liveNow is set, drop
 * anything scheduled before now. When liveNow is null, allow a 30-minute
 * grace so streams about to start don't disappear. Also dedup by title
 * against the live show.
 */
export function filterUpcoming(
  upcoming: UpcomingStream[],
  resolvedLiveNow: UpcomingStream | null,
  nowMs: number,
  parseDate: (s: string) => number
): UpcomingStream[] {
  const cutoff = resolvedLiveNow ? nowMs : nowMs - 30 * 60 * 1000;
  const liveTitle = resolvedLiveNow?.title.trim().toLowerCase() ?? '';
  return upcoming.filter((u) => {
    const dateMs = parseDate(u.date);
    if (dateMs !== 0 && dateMs < cutoff) return false;
    if (liveTitle && u.title.trim().toLowerCase() === liveTitle) return false;
    return true;
  });
}

/**
 * Parse Giant Bomb's upcoming-feed date strings. Format varies; we accept a
 * few common shapes and return 0 for unrecognized input so the resolver
 * treats them as "no scheduled time."
 */
export function parseUpcomingDate(raw: string): number {
  if (!raw) return 0;
  // Try ISO first.
  const direct = Date.parse(raw);
  if (!Number.isNaN(direct)) return direct;
  // GB sometimes uses "YYYY-MM-DD HH:MM:SS" without a T.
  const normalized = raw.replace(' ', 'T');
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}
