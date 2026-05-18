import { useEffect, useRef, useState } from 'react';

/**
 * Flips `inView` from false → true the first time the ref's element enters
 * (or comes within `rootMargin` of) the viewport. One-shot: once visible it
 * stays visible, so we don't re-fetch images on scroll.
 *
 * `rootMargin` of '200px' means the element starts loading ~200px before it
 * actually scrolls into view, which masks the load on a TV's slower decode.
 */
export function useInView<T extends HTMLElement>(rootMargin = '200px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView || !ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
