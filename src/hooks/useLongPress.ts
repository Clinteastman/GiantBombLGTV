import { useEffect, useRef } from 'react';

interface Options {
  /** Element is the currently focused spatial-nav target. We only listen
   * for keyboard long-press while focused, otherwise every card on screen
   * would arm a timer on each Enter press. */
  focused: boolean;
  /** Threshold in ms before keydown is considered a long press. */
  thresholdMs?: number;
  /** Fired on short tap of Enter (or mouse click). The card's normal action. */
  onShortPress: () => void;
  /** Fired after the press is held for `thresholdMs`. */
  onLongPress: () => void;
}

/**
 * Hook that gives an element both short and long press semantics.
 * Returns an object of handlers to spread onto the focusable element.
 *
 * Keyboard: while `focused`, a window-level Enter keydown starts the timer.
 * If keyup arrives before threshold, `onShortPress` fires. If the timer
 * elapses first, `onLongPress` fires and the upcoming keyup is suppressed.
 *
 * Mouse: right-click (contextmenu) fires `onLongPress`. Left-click fires
 * `onShortPress`. We don't try to detect held mouse-button because it's
 * unreliable across browsers and not the dominant input on a TV.
 */
export function useLongPress({
  focused,
  thresholdMs = 500,
  onShortPress,
  onLongPress,
}: Options) {
  const timerRef = useRef<number | null>(null);
  const longFiredRef = useRef(false);
  const shortCb = useRef(onShortPress);
  const longCb = useRef(onLongPress);
  shortCb.current = onShortPress;
  longCb.current = onLongPress;

  useEffect(() => {
    if (!focused) return;

    function clearTimer() {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter' || e.repeat) return;
      // Stop norigin and other Enter listeners from acting on this press.
      // We'll fire the short-press action ourselves on keyup.
      e.preventDefault();
      e.stopImmediatePropagation();
      longFiredRef.current = false;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        longFiredRef.current = true;
        longCb.current();
      }, thresholdMs);
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key !== 'Enter') return;
      if (longFiredRef.current) {
        longFiredRef.current = false;
        return;
      }
      if (timerRef.current != null) {
        clearTimer();
        shortCb.current();
      }
    }

    // capture phase so we run before norigin's bubble-phase listener.
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      clearTimer();
    };
  }, [focused, thresholdMs]);

  return {
    onClick: () => shortCb.current(),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      longCb.current();
    },
  };
}
