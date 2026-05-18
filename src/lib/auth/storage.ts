const KEY = 'gbtv.api_key';
const PREMIUM = 'gbtv.is_premium';
const PREF_QUALITY = 'gbtv.preferred_quality';

export type Quality = 'auto' | '1080' | '720' | '480' | '360';

export function loadApiKey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveApiKey(value: string): void {
  localStorage.setItem(KEY, value);
}

export function clearApiKey(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(PREMIUM);
}

export function loadPremium(): boolean {
  return localStorage.getItem(PREMIUM) === '1';
}

export function savePremium(value: boolean): void {
  localStorage.setItem(PREMIUM, value ? '1' : '0');
}

export function loadPreferredQuality(): Quality {
  const v = localStorage.getItem(PREF_QUALITY);
  if (v === '1080' || v === '720' || v === '480' || v === '360') return v;
  return 'auto';
}

export function savePreferredQuality(value: Quality): void {
  localStorage.setItem(PREF_QUALITY, value);
}
