export interface Video {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  publishDate: string;
  posterUrl: string | null;
  premium: boolean;
  showId: number | null;
  showTitle: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  /** Ordered fallback list. The card walks this on <img> onError so an
   * unreliable CDN URL doesn't leave a permanent broken icon. */
  thumbnailCandidates: string[];
  durationSeconds: number;
}

export interface Show {
  id: number;
  slug: string;
  title: string;
  deck: string;
  active: boolean;
  posterUrl: string | null;
  logoUrl: string | null;
}

export interface Mp4Source {
  url: string;
  width: number;
  height: number;
  label: string;
}

export interface PlaybackInfo {
  videoId: number;
  title: string;
  hlsUrl: string | null;
  mp4s: Mp4Source[];
  duration: number;
  posterUrl: string | null;
  youtubeUrl: string | null;
}

export interface ProgressEntry {
  videoId: number;
  currentTime: number;
  duration: number;
  percentComplete: number;
}

export interface UpcomingStream {
  type: string;
  title: string;
  image: string | null;
  date: string;
  premium: boolean;
  isLive?: boolean;
}

export interface UpcomingResponse {
  liveNow: UpcomingStream | null;
  upcoming: UpcomingStream[];
}

export interface KeyStatus {
  valid: boolean;
  premium: boolean;
}

export class ApiError extends Error {
  constructor(
    public httpCode: number,
    public endpoint: string,
    public userMessage: string,
    public responseSnippet: string
  ) {
    super(userMessage);
    this.name = 'ApiError';
  }
}
