import { useEffect, useRef } from 'react';

export default function AutoPlayVideo({ src, poster, className = '', onPlay, onError, onTimeUpdate, loop = true }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tryPlay = async () => {
      try {
        await el.play();
        onPlay?.();
      } catch (err) {
        // Most browsers require muted to auto-play
        try {
          el.muted = true;
          await el.play();
          onPlay?.();
        } catch (e2) {
          onError?.(e2);
        }
      }
    };

    const onCanPlay = () => tryPlay();
    const onLoadedMeta = () => tryPlay();
    const onTU = () => {
      if (typeof onTimeUpdate === 'function') onTimeUpdate(el.currentTime || 0, el.duration || 0);
    };
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('loadedmetadata', onLoadedMeta);
    el.addEventListener('timeupdate', onTU);
    // Try immediately if ready
    if (el.readyState >= 2) tryPlay();
    return () => {
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('loadedmetadata', onLoadedMeta);
      el.removeEventListener('timeupdate', onTU);
    };
  }, [src, onPlay, onError, onTimeUpdate]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      className={className}
      autoPlay
      muted
      playsInline
      loop={loop}
      crossOrigin="anonymous"
      controls={false}
      preload="metadata"
    />
  );
}
