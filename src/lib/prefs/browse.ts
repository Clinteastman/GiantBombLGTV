// Pure-TS browse preferences, persisted in localStorage. Mirrors the Android
// app's PrefsManager fields for sections + pinned shows so the two apps can
// converge if we ever sync prefs to the GB server side.

const PINNED_KEY = 'gbtv.pinned_show_ids';
const SECTION_ORDER_KEY = 'gbtv.section_order';
const HIDDEN_SECTIONS_KEY = 'gbtv.hidden_sections';

export const SECTION_LIVE = 'live';
export const SECTION_CONTINUE = 'continue';
export const SECTION_WATCHLIST = 'watchlist';
export const SECTION_RECENT = 'recent';
export const SECTION_PINNED = 'pinned';
export const SECTION_ACTIVE_SHOWS = 'active_shows';
export const SECTION_PREMIUM = 'premium';
export const SECTION_LEGACY = 'legacy';

export const DEFAULT_SECTION_ORDER: string[] = [
  SECTION_LIVE,
  SECTION_CONTINUE,
  SECTION_WATCHLIST,
  SECTION_RECENT,
  SECTION_PINNED,
  SECTION_ACTIVE_SHOWS,
  SECTION_PREMIUM,
  SECTION_LEGACY,
];

export const ALL_SECTIONS = new Set(DEFAULT_SECTION_ORDER);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage full or unavailable; silently ignore */
  }
}

export function getPinnedShowIds(): number[] {
  const list = readJson<number[]>(PINNED_KEY, []);
  return list.filter((n) => Number.isFinite(n));
}

export function setPinnedShowOrder(ids: number[]): void {
  writeJson(PINNED_KEY, Array.from(new Set(ids.filter((n) => Number.isFinite(n)))));
}

/** Pin if not pinned, unpin if pinned. Returns the new pinned state. */
export function togglePinnedShow(id: number): boolean {
  const current = getPinnedShowIds();
  const idx = current.indexOf(id);
  if (idx >= 0) {
    current.splice(idx, 1);
    setPinnedShowOrder(current);
    return false;
  }
  // New pins go to the top (most recently pinned first).
  setPinnedShowOrder([id, ...current]);
  return true;
}

/** Shift a pinned show by `delta` (-1 = up, +1 = down). No-op if out of range. */
export function movePinnedShow(id: number, delta: number): void {
  const current = getPinnedShowIds();
  const idx = current.indexOf(id);
  if (idx < 0) return;
  const newIdx = Math.max(0, Math.min(current.length - 1, idx + delta));
  if (newIdx === idx) return;
  current.splice(idx, 1);
  current.splice(newIdx, 0, id);
  setPinnedShowOrder(current);
}

/**
 * Returns the stored section order, merged with DEFAULT_SECTION_ORDER so any
 * new sections we add later automatically appear at their default position
 * for existing users (matches PrefsManager.kt:139).
 */
export function getSectionOrder(): string[] {
  const stored = readJson<string[] | null>(SECTION_ORDER_KEY, null);
  if (!stored) return [...DEFAULT_SECTION_ORDER];
  const known = stored.filter((s) => ALL_SECTIONS.has(s));
  const missing = DEFAULT_SECTION_ORDER.filter((s) => !known.includes(s));
  return [...known, ...missing];
}

export function setSectionOrder(order: string[]): void {
  writeJson(SECTION_ORDER_KEY, order.filter((s) => ALL_SECTIONS.has(s)));
}

export function moveSection(id: string, delta: number): void {
  const current = getSectionOrder();
  const idx = current.indexOf(id);
  if (idx < 0) return;
  const newIdx = Math.max(0, Math.min(current.length - 1, idx + delta));
  if (newIdx === idx) return;
  current.splice(idx, 1);
  current.splice(newIdx, 0, id);
  setSectionOrder(current);
}

export function getHiddenSections(): Set<string> {
  return new Set(readJson<string[]>(HIDDEN_SECTIONS_KEY, []));
}

export function setHiddenSections(hidden: Set<string>): void {
  writeJson(HIDDEN_SECTIONS_KEY, Array.from(hidden));
}

export function toggleHiddenSection(id: string): boolean {
  const current = getHiddenSections();
  if (current.has(id)) {
    current.delete(id);
  } else {
    current.add(id);
  }
  setHiddenSections(current);
  return current.has(id);
}
