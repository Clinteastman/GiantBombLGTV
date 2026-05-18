import { useEffect, useState } from 'react';
import { Setup } from './screens/Setup';
import { Browse } from './screens/Browse';
import { Detail } from './screens/Detail';
import { Playback } from './screens/Playback';
import { Search } from './screens/Search';
import { ShowBrowse } from './screens/ShowBrowse';
import { loadApiKey } from './lib/auth/storage';
import { Show, Video } from './lib/api/types';

type Origin = 'browse' | 'search' | 'show';

type Screen =
  | { name: 'loading' }
  | { name: 'setup' }
  | { name: 'browse' }
  | { name: 'search' }
  | { name: 'show'; show: Show }
  | { name: 'detail'; video: Video; from: Origin }
  | { name: 'playback'; video: Video; from: Origin };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });
  // Track the last show we opened so detail→back from a show drill-in returns
  // there rather than to the home Browse.
  const [lastShow, setLastShow] = useState<Show | null>(null);

  useEffect(() => {
    const key = loadApiKey();
    setScreen(key ? { name: 'browse' } : { name: 'setup' });
  }, []);

  function backFrom(from: Origin): Screen {
    if (from === 'search') return { name: 'search' };
    if (from === 'show' && lastShow) return { name: 'show', show: lastShow };
    return { name: 'browse' };
  }

  if (screen.name === 'loading') {
    return <div className="splash">Giant Bomb TV</div>;
  }
  if (screen.name === 'setup') {
    return <Setup onDone={() => setScreen({ name: 'browse' })} />;
  }
  if (screen.name === 'browse') {
    return (
      <Browse
        onSelect={(video) => setScreen({ name: 'detail', video, from: 'browse' })}
        onSelectShow={(show) => {
          setLastShow(show);
          setScreen({ name: 'show', show });
        }}
        onSearch={() => setScreen({ name: 'search' })}
        onSignOut={() => setScreen({ name: 'setup' })}
      />
    );
  }
  if (screen.name === 'search') {
    return (
      <Search
        onSelect={(video) => setScreen({ name: 'detail', video, from: 'search' })}
        onBack={() => setScreen({ name: 'browse' })}
      />
    );
  }
  if (screen.name === 'show') {
    return (
      <ShowBrowse
        show={screen.show}
        onSelect={(video) => setScreen({ name: 'detail', video, from: 'show' })}
        onBack={() => setScreen({ name: 'browse' })}
      />
    );
  }
  if (screen.name === 'detail') {
    const from = screen.from;
    return (
      <Detail
        video={screen.video}
        onBack={() => setScreen(backFrom(from))}
        onWatch={(video) =>
          setScreen({ name: 'playback', video, from })
        }
      />
    );
  }
  return (
    <Playback
      video={screen.video}
      onBack={() => setScreen({ name: 'detail', video: screen.video, from: screen.from })}
    />
  );
}
