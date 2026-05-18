import {
  ApiError,
  KeyStatus,
  Mp4Source,
  PlaybackInfo,
  ProgressEntry,
  Show,
  UpcomingResponse,
  UpcomingStream,
  Video,
} from './types';
import { getTwitchLiveStatus } from './twitch';
import { filterUpcoming, parseUpcomingDate, resolveLiveNow } from '../upcoming/resolver';

const LIVE_TWITCH_CHANNEL = 'giantbomb';

// In dev, requests go through Vite's /gb proxy to dodge CORS. In production
// (webOS .ipk), the app is privileged enough to fetch giantbomb.com directly.
const BASE = import.meta.env.DEV ? '/gb' : 'https://giantbomb.com';

export interface GiantBombClient {
  validateKey(): Promise<KeyStatus>;
  getVideos(opts?: {
    limit?: number;
    offset?: number;
    showId?: number;
    premium?: boolean;
    query?: string;
  }): Promise<Video[]>;
  getVideo(id: number): Promise<Video | null>;
  getVideosByIds(ids: number[]): Promise<Video[]>;
  getShows(limit?: number): Promise<Show[]>;
  getPlayback(videoId: number): Promise<PlaybackInfo>;
  getProgress(): Promise<ProgressEntry[]>;
  saveProgress(videoId: number, currentTime: number, duration: number): Promise<void>;
  markWatched(videoId: number): Promise<void>;
  getWatchlist(): Promise<Video[]>;
  addToWatchlist(videoId: number): Promise<void>;
  removeFromWatchlist(videoId: number): Promise<void>;
  getUpcoming(): Promise<UpcomingResponse>;
}

export function createClient(apiKey: string): GiantBombClient {
  return new Client(apiKey);
}

class Client implements GiantBombClient {
  constructor(private readonly apiKey: string) {}

  async validateKey(): Promise<KeyStatus> {
    const json = await this.get(`/api/public/key-status?api_key=${this.apiKey}`);
    return { valid: true, premium: Boolean(json.is_premium) };
  }

  async getVideos(opts: {
    limit?: number;
    offset?: number;
    showId?: number;
    premium?: boolean;
    query?: string;
  } = {}): Promise<Video[]> {
    const params = [
      `api_key=${this.apiKey}`,
      `limit=${opts.limit ?? 20}`,
      `offset=${opts.offset ?? 0}`,
      'images=true',
    ];
    if (opts.showId != null) params.push(`video_show=${opts.showId}`);
    if (opts.premium != null) params.push(`premium=${opts.premium}`);
    if (opts.query) params.push(`q=${encodeURIComponent(opts.query)}`);
    const json = await this.get(`/api/public/videos?${params.join('&')}`);
    return parseVideos(json.results ?? []);
  }

  async getVideo(id: number): Promise<Video | null> {
    const list = await this.getVideosByIds([id]);
    return list[0] ?? null;
  }

  async getVideosByIds(ids: number[]): Promise<Video[]> {
    const unique = Array.from(new Set(ids.filter((n) => Number.isFinite(n))));
    if (unique.length === 0) return [];
    // GB API filter uses pipe-separated values: ?filter=id:1|2|3
    const filter = `id:${unique.join('|')}`;
    const params = [
      `api_key=${this.apiKey}`,
      `limit=${Math.max(unique.length, 20)}`,
      'images=true',
      `filter=${encodeURIComponent(filter)}`,
    ];
    const json = await this.get(`/api/public/videos?${params.join('&')}`);
    return parseVideos(json.results ?? []);
  }

  async getShows(limit = 100): Promise<Show[]> {
    const json = await this.get(
      `/api/public/shows?api_key=${this.apiKey}&limit=${limit}&sort=latest_video:desc`
    );
    const results = (json.results ?? []) as RawShow[];
    return results.map((s) => ({
      id: s.id,
      slug: s.slug ?? '',
      title: s.title ?? '',
      deck: s.deck ?? '',
      active: Boolean(s.active),
      posterUrl: s.poster_image?.url ?? null,
      logoUrl: s.logo_image?.url ?? null,
    }));
  }

  async getPlayback(videoId: number): Promise<PlaybackInfo> {
    const json = await this.get(
      `/api/public/videos/${videoId}/playback?api_key=${this.apiKey}`
    );
    const sources: RawSources | undefined = json.premium ?? json.free;
    const mp4s: Mp4Source[] = (sources?.mp4s ?? []).map((m) => ({
      url: m.url,
      width: m.width ?? 0,
      height: m.height ?? 0,
      label: m.label ?? '',
    }));
    return {
      videoId,
      title: json.title ?? '',
      hlsUrl: sources?.hls_url ?? null,
      mp4s,
      duration: sources?.duration ?? 0,
      posterUrl: sources?.poster ?? null,
      youtubeUrl: sanitizeYoutubeUrl(json.youtube_url ?? null),
    };
  }

  async getProgress(): Promise<ProgressEntry[]> {
    const json = await this.get(
      `/api/public/video-progress?api_key=${this.apiKey}&limit=100`
    );
    const results = (json.results ?? []) as RawProgress[];
    return results.map((p) => ({
      videoId: p.video_id,
      currentTime: p.current_time,
      duration: p.duration,
      percentComplete: p.percent_complete ?? 0,
    }));
  }

  async saveProgress(videoId: number, currentTime: number, duration: number): Promise<void> {
    await this.post(`/api/public/video-progress?api_key=${this.apiKey}`, {
      video_id: videoId,
      current_time: currentTime,
      duration,
    });
  }

  async markWatched(videoId: number): Promise<void> {
    await this.post(`/api/public/watched?api_key=${this.apiKey}`, { video_id: videoId });
  }

  async getWatchlist(): Promise<Video[]> {
    const json = await this.get(
      `/api/public/watchlist?api_key=${this.apiKey}&limit=100&images=true`
    );
    return parseVideos(json.results ?? []);
  }

  async addToWatchlist(videoId: number): Promise<void> {
    await this.post(`/api/public/watchlist?api_key=${this.apiKey}`, { video_id: videoId });
  }

  async removeFromWatchlist(videoId: number): Promise<void> {
    await this.del(`/api/public/watchlist?api_key=${this.apiKey}&video_id=${videoId}`);
  }

  async getUpcoming(): Promise<UpcomingResponse> {
    // Fetch /upcoming_json and the authoritative Twitch live signal in
    // parallel. /upcoming_json sits behind Cloudflare and can fail with a 403
    // challenge at any time — when that happens we still want a usable
    // response, derived from Twitch alone.
    const [feedResult, twitchStatus] = await Promise.all([
      this.get('/upcoming_json').catch(() => null),
      getTwitchLiveStatus(LIVE_TWITCH_CHANNEL).catch(() => null),
    ]);

    const apiLiveNow: UpcomingStream | null = feedResult?.liveNow
      ? {
          type: feedResult.liveNow.type ?? '',
          title: feedResult.liveNow.title ?? '',
          image: nonEmpty(feedResult.liveNow.image),
          date: feedResult.liveNow.date ?? '',
          premium: Boolean(feedResult.liveNow.premium),
          isLive: true,
        }
      : null;

    const upcomingRaw: any[] = Array.isArray(feedResult?.upcoming)
      ? feedResult.upcoming
      : [];
    const upcoming: UpcomingStream[] = upcomingRaw.map((u) => ({
      type: u.type ?? '',
      title: u.title ?? '',
      image: nonEmpty(u.image),
      date: u.date ?? '',
      premium: Boolean(u.premium),
    }));

    const resolvedLiveNow = resolveLiveNow(apiLiveNow, twitchStatus);
    const filtered = filterUpcoming(upcoming, resolvedLiveNow, Date.now(), parseUpcomingDate);
    return { liveNow: resolvedLiveNow, upcoming: filtered };
  }

  private async get(path: string): Promise<any> {
    return this.request('GET', path);
  }

  private async post(path: string, body: unknown): Promise<any> {
    return this.request('POST', path, body);
  }

  private async del(path: string): Promise<any> {
    return this.request('DELETE', path);
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const url = `${BASE}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        Accept: 'application/json',
      },
    };
    if (body !== undefined) {
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(url, init);
    const text = await res.text();
    if (!res.ok) {
      throw toApiError(res.status, path, text);
    }
    return text ? JSON.parse(text) : {};
  }
}

function toApiError(code: number, path: string, text: string): ApiError {
  const endpoint = path.split('?')[0];
  const lower = text.toLowerCase();
  const isCloudflare =
    lower.includes('cloudflare') ||
    lower.includes('cf-browser-verification') ||
    lower.includes('challenge-platform');
  let userMessage: string;
  if (code === 403 && isCloudflare) {
    userMessage = `Blocked by Cloudflare (403). Try again in a few minutes.`;
  } else if (code === 403 || code === 401) {
    userMessage = `Not authorized (${code}). Your API key may be invalid or expired.`;
  } else if (code === 429) {
    userMessage = `Too many requests (429). Please wait a minute and try again.`;
  } else if (code >= 500 && code < 600) {
    userMessage = `Giant Bomb server error (${code}). Try again later.`;
  } else {
    userMessage = `Request failed (${code}). Try again or check your connection.`;
  }
  return new ApiError(code, endpoint, userMessage, text.slice(0, 300));
}

function sanitizeYoutubeUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

function parseVideos(raw: RawVideo[]): Video[] {
  return raw.map((v) => {
    const show = v.show ?? null;
    const candidates = buildThumbCandidates(v);
    return {
      id: v.id,
      slug: v.slug ?? '',
      title: v.title ?? '',
      description: nonEmpty(v.description),
      publishDate: v.publish_date ?? '',
      posterUrl: nonEmpty(v.poster_url),
      premium: Boolean(v.premium),
      showId: show?.id ?? null,
      showTitle: show?.title ?? null,
      author: nonEmpty(v.author),
      thumbnailUrl: candidates[0] ?? null,
      thumbnailCandidates: candidates,
      durationSeconds: v.length_seconds ?? 0,
    };
  });
}

function buildThumbCandidates(v: RawVideo): string[] {
  // GB image objects can carry up to a dozen sized variants. Most videos
  // expose only some, but feeding the full list to the card means a single
  // dud CDN URL doesn't kill the whole thumbnail.
  const fromImage = (i: RawImage | undefined): Array<string | undefined> =>
    i
      ? [
          i.url,
          i.medium_url,
          i.screen_url,
          i.screen_large_url,
          i.super_url,
          i.small_url,
          i.thumb_url,
          i.original_url,
          i.icon_url,
          i.tiny_url,
        ]
      : [];
  const raw: Array<string | null | undefined> = [
    ...fromImage(v.thumbnail),
    ...fromImage(v.image),
    v.poster_url,
    deriveYoutubeThumb(v.youtube_url ?? null),
    v.images?.poster,
    ...(v.images?.thumbnails ?? []).map((t) => t.src),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of raw) {
    if (typeof url !== 'string') continue;
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'null' || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function deriveYoutubeThumb(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const isYt =
      host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
    if (!isYt) return null;
    const id = u.searchParams.get('v') ?? u.pathname.split('/').filter(Boolean).pop();
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

function nonEmpty(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t.length === 0 || t === 'null' ? null : t;
}

// Raw response shapes (just the fields we read).
interface RawShow {
  id: number;
  slug?: string;
  title?: string;
  deck?: string;
  active?: boolean;
  poster_image?: { url?: string };
  logo_image?: { url?: string };
}

interface RawImage {
  url?: string;
  medium_url?: string;
  small_url?: string;
  screen_url?: string;
  screen_large_url?: string;
  super_url?: string;
  thumb_url?: string;
  original_url?: string;
  icon_url?: string;
  tiny_url?: string;
}

interface RawVideo {
  id: number;
  slug?: string;
  title?: string;
  description?: string;
  publish_date?: string;
  poster_url?: string;
  premium?: boolean;
  author?: string;
  length_seconds?: number;
  youtube_url?: string;
  show?: { id: number; title?: string };
  thumbnail?: RawImage;
  image?: RawImage;
  images?: { poster?: string; thumbnails?: Array<{ src?: string }> };
}

interface RawSources {
  hls_url?: string;
  duration?: number;
  poster?: string;
  mp4s?: Array<{ url: string; width?: number; height?: number; label?: string }>;
}

interface RawProgress {
  video_id: number;
  current_time: number;
  duration: number;
  percent_complete?: number;
}
