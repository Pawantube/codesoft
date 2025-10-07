import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const clampIndex = (value, max) => {
  if (max <= 0) return 0;
  if (value < 0) return 0;
  if (value >= max) return max - 1;
  return value;
};

export default function VideoFeed() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [interestFilter, setInterestFilter] = useState('');

  const videoRefs = useRef([]);
  const lastViewedRef = useRef(null);

  const currentItem = items[currentIndex] || null;

  const fetchFeed = useCallback(async (interest) => {
    setLoading(true);
    try {
      const params = { limit: 12 };
      if (interest) params.interest = interest;
      const res = await api.get('/feed/videos', { params });
      const data = Array.isArray(res.data) ? res.data : [];
      setItems(data);
      setCurrentIndex(0);
      lastViewedRef.current = null;
    } catch (error) {
      console.error(error);
      setItems([]);
      setCurrentIndex(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const recordInteraction = useCallback(async (item, action, extra = {}) => {
    if (!item) return;
    try {
      await api.post(`/feed/videos/${item.candidateId}/interactions`, {
        action,
        watchSeconds: extra.watchSeconds,
      });
    } catch (error) {
      console.error('Failed to record interaction', error);
    }
  }, []);

  useEffect(() => {
    const item = items[currentIndex];
    if (!item) return;

    const videoEl = videoRefs.current[currentIndex];
    videoRefs.current.forEach((el, idx) => {
      if (!el || idx === currentIndex) return;
      el.pause();
    });

    if (videoEl) {
      try {
        videoEl.currentTime = 0;
        const playPromise = videoEl.play();
        if (playPromise?.catch) playPromise.catch(() => {});
      } catch {
        // ignore autoplay issues
      }
    }

    if (lastViewedRef.current !== item.candidateId) {
      recordInteraction(item, 'view');
      lastViewedRef.current = item.candidateId;
    }
  }, [currentIndex, items, recordInteraction]);

  const goTo = useCallback((direction) => {
    setCurrentIndex((prev) => clampIndex(prev + direction, items.length));
  }, [items.length]);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(1);
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(-1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goTo]);

  const handleLike = async () => {
    if (!currentItem) return;
    await recordInteraction(currentItem, 'like');
    goTo(1);
  };

  const handleSkip = async () => {
    if (!currentItem) return;
    await recordInteraction(currentItem, 'skip');
    goTo(1);
  };

  const nextLabel = useMemo(() => {
    if (!items.length) return '';
    return `${currentIndex + 1}/${items.length}`;
  }, [currentIndex, items.length]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <header className="rounded-xl border bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-semibold">Discover Video Profiles</h1>
        <p className="mt-1 text-sm text-gray-600">
          Scroll with arrow keys or use the controls below. Videos are recommended based on skills, tags, and your interests.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={interestFilter}
            onChange={(e) => setInterestFilter(e.target.value)}
            placeholder="Filter by interest or tag (comma separated)"
            className="flex-1 min-w-[220px] rounded-lg border px-3 py-2 text-sm"
          />
          <button
            onClick={() => fetchFeed(interestFilter)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="relative flex flex-col items-center">
        {loading && <div className="p-6 text-sm text-gray-500">Loading feed…</div>}
        {!loading && !items.length && (
          <div className="p-6 text-sm text-gray-500">
            No video profiles yet. Candidates can upload their intro videos from the profile page.
          </div>
        )}

        {!loading && currentItem && (
          <div className="relative w-full overflow-hidden rounded-2xl border bg-black shadow-lg">
            <video
              ref={(el) => (videoRefs.current[currentIndex] = el)}
              src={currentItem.videoUrl}
              controls
              playsInline
              className="h-[70vh] w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em]">
                <span>Video {nextLabel}</span>
                {currentItem.score && <span>Score {currentItem.score.toFixed(1)}</span>}
              </div>
              <div className="mt-3 text-lg font-semibold">{currentItem.candidate.name}</div>
              {currentItem.candidate.headline && (
                <div className="text-sm text-gray-200">{currentItem.candidate.headline}</div>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-200">
                {(currentItem.videoTags || []).map((tag) => (
                  <span key={tag} className="rounded-full bg-white/20 px-2 py-1">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {currentItem && (
        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
          <div className="text-sm text-gray-600">
            <div>{currentItem.candidate.location || 'Location not specified'}</div>
            <div className="mt-1">Skills: {(currentItem.candidate.skills || []).join(', ') || 'n/a'}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goTo(-1)}
              disabled={currentIndex === 0}
              className="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={handleSkip}
              className="rounded-lg border px-3 py-2 text-sm text-gray-700"
            >
              Skip
            </button>
            <button
              onClick={handleLike}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Interested
            </button>
            <button
              onClick={() => goTo(1)}
              disabled={currentIndex >= items.length - 1}
              className="rounded-lg border px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
