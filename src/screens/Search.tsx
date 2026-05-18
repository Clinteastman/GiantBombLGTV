import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import { createClient } from '../lib/api/giantbomb';
import { loadApiKey } from '../lib/auth/storage';
import { Video } from '../lib/api/types';
import { VideoCard } from '../components/VideoCard';

interface Props {
  onSelect: (video: Video) => void;
  onBack: () => void;
}

const DEBOUNCE_MS = 400;

export function Search({ onSelect, onBack }: Props) {
  const apiKey = loadApiKey()!;
  const client = useMemo(() => createClient(apiKey), [apiKey]);

  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { ref, focusKey } = useFocusable({ focusKey: 'search-root' });

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(text.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [text]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'XF86Back' || (e as any).keyCode === 461) {
        e.preventDefault();
        onBack();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  useEffect(() => {
    setFocus('search-input');
    inputRef.current?.focus();
  }, []);

  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => client.getVideos({ query: debounced, limit: 40 }),
    enabled: debounced.length >= 2,
  });

  const { ref: inputFocusRef, focused: inputFocused } = useFocusable({
    focusKey: 'search-input',
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="search">
        <div
          ref={inputFocusRef as any}
          className={`input-wrap focusable ${inputFocused ? 'focused' : ''}`}
          onClick={() => inputRef.current?.focus()}
        >
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search Giant Bomb"
            autoFocus
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
        </div>

        {debounced.length < 2 && (
          <div className="hint">Type at least 2 characters to search.</div>
        )}

        {results.isFetching && debounced.length >= 2 && (
          <div className="hint">Searching for "{debounced}"...</div>
        )}

        {results.isError && (
          <div className="hint error">{errMsg(results.error)}</div>
        )}

        {results.data && results.data.length === 0 && !results.isFetching && (
          <div className="hint">No results for "{debounced}".</div>
        )}

        {results.data && results.data.length > 0 && (
          <ResultsGrid videos={results.data} onSelect={onSelect} />
        )}

        <style>{`
          .search {
            padding: 3rem 4rem;
            height: 100%;
            overflow-y: auto;
            scrollbar-width: none;
          }
          .search::-webkit-scrollbar { display: none; }
          .input-wrap {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            padding: 1.1rem 1.5rem;
            margin-bottom: 2.5rem;
            max-width: 60rem;
          }
          .input-wrap input {
            background: transparent;
            border: 0;
            outline: none;
            font-size: 1.6rem;
            width: 100%;
            color: white;
          }
          .input-wrap input::placeholder { opacity: 0.5; }
          .hint {
            font-size: 1.2rem;
            opacity: 0.65;
            padding: 1rem 0;
          }
          .hint.error { color: #ff8a8a; opacity: 1; }
        `}</style>
      </div>
    </FocusContext.Provider>
  );
}

function ResultsGrid({
  videos,
  onSelect,
}: {
  videos: Video[];
  onSelect: (video: Video) => void;
}) {
  const { ref, focusKey } = useFocusable({ focusKey: 'search-results' });
  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className="grid">
        {videos.map((v) => (
          <VideoCard
            key={v.id}
            video={v}
            onSelect={onSelect}
            focusKey={`search-${v.id}`}
          />
        ))}
        <style>{`
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(26rem, 1fr));
            gap: 1.75rem 1.25rem;
            padding-bottom: 3rem;
          }
        `}</style>
      </div>
    </FocusContext.Provider>
  );
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}
