import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { init as initSpatial } from '@noriginmedia/norigin-spatial-navigation';
import App from './App';
import './styles/global.css';

// Anchor the design to 1920x1080 (the webOS WebView's logical size). Every rem
// in the UI scales relative to this reference, so a 4K monitor in dev or a
// non-standard window size gets the same layout as a real TV. On webOS this
// resolves to scale = 1.
const DESIGN_W = 1920;
const DESIGN_H = 1080;
function applyScale() {
  const scale = Math.min(
    window.innerWidth / DESIGN_W,
    window.innerHeight / DESIGN_H
  );
  document.documentElement.style.fontSize = `${16 * scale}px`;
}
applyScale();
window.addEventListener('resize', applyScale);

initSpatial({
  debug: false,
  visualDebug: false,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
