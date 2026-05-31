import { useEffect } from 'react';
import { isBackKey } from '../lib/tv/keys';

interface Options {
  /** Listen in the capture phase and stop propagation, so a modal swallows the
   * back press before the screen beneath it reacts to the same key. */
  capture?: boolean;
}

/**
 * Invoke `onBack` when the user presses Esc / the webOS back button. Used by
 * modals and full-screen players so back-handling isn't re-implemented (with
 * drifting keycode literals) in every one.
 */
export function useBackKey(onBack: () => void, { capture = false }: Options = {}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isBackKey(e)) return;
      e.preventDefault();
      if (capture) e.stopImmediatePropagation();
      onBack();
    }
    window.addEventListener('keydown', onKey, capture);
    return () => window.removeEventListener('keydown', onKey, capture);
  }, [onBack, capture]);
}
