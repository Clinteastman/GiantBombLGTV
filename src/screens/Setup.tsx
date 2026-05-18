import { useState } from 'react';
import { createClient } from '../lib/api/giantbomb';
import { saveApiKey, savePremium } from '../lib/auth/storage';
import logoUrl from '../assets/logo.png';

export function Setup({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const key = value.trim();
    if (!key) return;
    setStatus('checking');
    setError(null);
    try {
      const result = await createClient(key).validateKey();
      saveApiKey(key);
      savePremium(result.premium);
      onDone();
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  return (
    <div className="setup-screen">
      <img className="setup-wordmark" src={logoUrl} alt="Giant Bomb TV" />
      <p className="setup-subtitle">
        Enter your Giant Bomb API key. You can find it at{' '}
        <span className="setup-link">giantbomb.com/api/</span> after signing in.
      </p>
      <input
        className="setup-input focusable focused"
        type="text"
        autoFocus
        placeholder="API key"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
      <div className="setup-actions">
        <button
          className="setup-button focusable"
          disabled={status === 'checking' || value.trim().length === 0}
          onClick={submit}
        >
          {status === 'checking' ? 'Checking...' : 'Continue'}
        </button>
      </div>
      {error && <p className="setup-error">{error}</p>}
      <style>{`
        .setup-screen {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 6rem 8rem;
          height: 100%;
          max-width: 70rem;
        }
        .setup-wordmark {
          height: 4.5rem;
          width: auto;
          display: block;
          margin-bottom: 1.5rem;
        }
        .setup-subtitle {
          font-size: 1.5rem;
          line-height: 1.5;
          margin: 0 0 3rem;
          opacity: 0.75;
        }
        .setup-link {
          color: #ff6b6b;
        }
        .setup-input {
          font-size: 1.75rem;
          padding: 1.25rem 1.5rem;
          width: 100%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 8px;
          margin-bottom: 2rem;
        }
        .setup-actions {
          display: flex;
          gap: 1.25rem;
        }
        .setup-button {
          font-size: 1.5rem;
          padding: 1rem 2.5rem;
          background: #cc0000;
          border: 0;
          border-radius: 8px;
          cursor: pointer;
        }
        .setup-button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .setup-error {
          color: #ff8a8a;
          font-size: 1.2rem;
          margin-top: 1.5rem;
        }
      `}</style>
    </div>
  );
}
