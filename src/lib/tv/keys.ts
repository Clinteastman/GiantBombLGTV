// webOS remote keycodes. The browser `key` value is usually enough, but some
// webOS builds only deliver the numeric keyCode, so we match on both.
export const WEBOS_BACK_KEYCODE = 461;
export const WEBOS_PLAY_PAUSE_KEYCODE = 463;

/** True for Esc / the webOS back button — the universal "dismiss" gesture. */
export function isBackKey(e: KeyboardEvent): boolean {
  return (
    e.key === 'Escape' ||
    e.key === 'XF86Back' ||
    (e as any).keyCode === WEBOS_BACK_KEYCODE
  );
}

/** True for Space / the dedicated play-pause media key on the remote. */
export function isPlayPauseKey(e: KeyboardEvent): boolean {
  return (
    e.key === ' ' ||
    e.key === 'MediaPlayPause' ||
    (e as any).keyCode === WEBOS_PLAY_PAUSE_KEYCODE
  );
}
