import { ReactNode, useRef, useEffect } from 'react';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';

interface Props {
  title: string;
  focusKey: string;
  children: ReactNode;
  /** When set, the title becomes a focusable element that opens this menu on
   * Enter, click, or right-click. Used by Browse to surface section actions
   * (move up, move down, hide) or per-show actions (pin, unpin, move). */
  onTitleMenu?: () => void;
}

export function Row({ title, focusKey, onTitleMenu, children }: Props) {
  const { ref, focusKey: ctx, hasFocusedChild } = useFocusable({
    focusKey,
    saveLastFocusedChild: true,
    trackChildren: true,
  });

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const rowRef = ref as React.RefObject<HTMLDivElement>;

  // Scroll the row horizontally to keep the focused child in view.
  useEffect(() => {
    if (!hasFocusedChild || !scrollerRef.current) return;
    const focused = scrollerRef.current.querySelector('.focusable.focused') as HTMLElement | null;
    if (!focused) return;
    const scroller = scrollerRef.current;
    const sRect = scroller.getBoundingClientRect();
    const fRect = focused.getBoundingClientRect();
    if (fRect.left < sRect.left + 80) {
      scroller.scrollLeft += fRect.left - sRect.left - 80;
    } else if (fRect.right > sRect.right - 80) {
      scroller.scrollLeft += fRect.right - sRect.right + 80;
    }
  });

  // Scroll the page vertically when this row gains focus, so later rows
  // become reachable instead of stuck below the fold.
  useEffect(() => {
    if (!hasFocusedChild || !rowRef.current) return;
    const row = rowRef.current;
    const container = findScrollableAncestor(row);
    if (!container) return;
    const rRect = row.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const targetTop = cRect.top + cRect.height * 0.25;
    const delta = rRect.top - targetTop;
    if (Math.abs(delta) > 8) {
      container.scrollBy({ top: delta, behavior: 'smooth' });
    }
  }, [hasFocusedChild]);

  return (
    <FocusContext.Provider value={ctx}>
      <div ref={ref} className="row">
        <RowTitle
          text={title}
          focusKey={`${focusKey}-title`}
          onMenu={onTitleMenu}
        />
        <div ref={scrollerRef} className="row-scroller">
          {children}
        </div>
        <style>{`
          .row {
            margin-bottom: 2.5rem;
          }
          .row-scroller {
            display: flex;
            gap: 1.25rem;
            padding: 0.5rem 4rem 1.5rem;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            scrollbar-width: none;
          }
          .row-scroller::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </FocusContext.Provider>
  );
}

function RowTitle({
  text,
  focusKey,
  onMenu,
}: {
  text: string;
  focusKey: string;
  onMenu?: () => void;
}) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onMenu?.(),
  });
  return (
    <h2
      ref={ref as any}
      className={`row-title focusable ${focused ? 'focused' : ''} ${
        onMenu ? 'row-title-menu' : ''
      }`}
      onClick={() => onMenu?.()}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu?.();
      }}
    >
      {text}
      <style>{`
        .row-title {
          font-size: 1.85rem;
          margin: 0 0 1.1rem 4rem;
          letter-spacing: 0.02em;
          opacity: 0.9;
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 6px;
          cursor: default;
        }
        .row-title-menu {
          cursor: pointer;
        }
      `}</style>
    </h2>
  );
}

function findScrollableAncestor(el: HTMLElement): HTMLElement | null {
  let cur: HTMLElement | null = el.parentElement;
  while (cur) {
    const overflowY = getComputedStyle(cur).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && cur.scrollHeight > cur.clientHeight) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}
