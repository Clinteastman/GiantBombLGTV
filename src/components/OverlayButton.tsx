import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

interface Props {
  focusKey: string;
  label: string;
  onPress: () => void;
}

/**
 * A focusable button for the player overlays (Back, Quality, ...). Shared by
 * Playback and LivePlayback so the `.ovbtn` styling and focus wiring live in
 * one spot instead of being copy-pasted per screen.
 */
export function OverlayButton({ focusKey, label, onPress }: Props) {
  const { ref, focused } = useFocusable({ focusKey, onEnterPress: onPress });
  return (
    <button
      ref={ref as any}
      className={`ovbtn focusable ${focused ? 'focused' : ''}`}
      onClick={onPress}
    >
      {label}
      <style>{`
        .ovbtn {
          background: rgba(0, 0, 0, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 0.7rem 1.4rem;
          font-size: 1.05rem;
          border-radius: 6px;
          cursor: pointer;
        }
      `}</style>
    </button>
  );
}
