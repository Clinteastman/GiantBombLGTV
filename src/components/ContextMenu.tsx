import { useEffect } from 'react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface Props {
  title?: string;
  items: MenuItem[];
  onClose: () => void;
}

/**
 * Centered modal context menu used by long-press / right-click on cards.
 * Captures Esc and the webOS back keycode (461) to close, traps focus to
 * the first menu item on open, and restores the previous focus on close.
 */
export function ContextMenu({ title, items, onClose }: Props) {
  const { ref, focusKey } = useFocusable({ focusKey: 'context-menu' });

  useEffect(() => {
    setFocus('context-menu-item-0');
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'XF86Back' || (e as any).keyCode === 461) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div className="ctx-backdrop" onClick={onClose}>
        <div
          ref={ref}
          className="ctx-menu"
          onClick={(e) => e.stopPropagation()}
        >
          {title && <h3 className="ctx-title">{title}</h3>}
          <ul className="ctx-list">
            {items.map((item, i) => (
              <ContextMenuItem
                key={i}
                index={i}
                item={item}
                onClose={onClose}
              />
            ))}
          </ul>
        </div>
        <style>{`
          .ctx-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 400;
          }
          .ctx-menu {
            background: #1a1a22;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 14px;
            padding: 1.5rem;
            min-width: 22rem;
            max-width: 32rem;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
          }
          .ctx-title {
            margin: 0 0 1rem;
            padding: 0 0.6rem;
            font-size: 1.1rem;
            opacity: 0.6;
            font-weight: 500;
            letter-spacing: 0.04em;
          }
          .ctx-list {
            list-style: none;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }
        `}</style>
      </div>
    </FocusContext.Provider>
  );
}

function ContextMenuItem({
  index,
  item,
  onClose,
}: {
  index: number;
  item: MenuItem;
  onClose: () => void;
}) {
  const { ref, focused } = useFocusable({
    focusKey: `context-menu-item-${index}`,
    onEnterPress: () => {
      if (item.disabled) return;
      item.onSelect();
      onClose();
    },
  });
  return (
    <li
      ref={ref as any}
      className={`ctx-item focusable ${focused ? 'focused' : ''} ${
        item.disabled ? 'disabled' : ''
      }`}
      onClick={() => {
        if (item.disabled) return;
        item.onSelect();
        onClose();
      }}
    >
      {item.label}
      <style>{`
        .ctx-item {
          padding: 0.85rem 1rem;
          font-size: 1.2rem;
          border-radius: 8px;
          cursor: pointer;
        }
        .ctx-item.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </li>
  );
}
