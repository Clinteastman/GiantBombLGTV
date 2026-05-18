import { Mp4Source, PlaybackInfo } from '../api/types';
import { Quality } from '../auth/storage';

export interface ResolvedSource {
  kind: 'hls' | 'mp4';
  url: string;
  label: string;
}

// Mirrors the Android quality-picker logic: "auto" → HLS if present,
// otherwise highest MP4. Specific resolutions → matching MP4 by height,
// falling back to nearest available, then HLS, then highest MP4.
export function resolveSource(
  info: PlaybackInfo,
  preferred: Quality
): ResolvedSource | null {
  const sortedMp4s = [...info.mp4s].sort((a, b) => b.height - a.height);

  if (preferred === 'auto') {
    if (info.hlsUrl) return { kind: 'hls', url: info.hlsUrl, label: 'Auto (HLS)' };
    const top = sortedMp4s[0];
    return top ? mp4Source(top) : null;
  }

  const target = Number(preferred);
  const exact = sortedMp4s.find((m) => m.height === target);
  if (exact) return mp4Source(exact);

  const nearest = sortedMp4s.reduce<Mp4Source | null>((best, cur) => {
    if (!best) return cur;
    return Math.abs(cur.height - target) < Math.abs(best.height - target) ? cur : best;
  }, null);
  if (nearest) return mp4Source(nearest);

  if (info.hlsUrl) return { kind: 'hls', url: info.hlsUrl, label: 'Auto (HLS)' };
  return null;
}

function mp4Source(m: Mp4Source): ResolvedSource {
  const label = m.label || `${m.height}p`;
  return { kind: 'mp4', url: m.url, label };
}
