import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';
import { fileUrl } from '../utils/fileUrl';

export default function Interested() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/interests');
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const goChat = (id) => {
    nav(`/chat?u=${id}`);
  };

  const removeInterest = async (candidateId) => {
    try {
      await api.delete(`/interests/${candidateId}`);
      setItems((prev) => prev.filter((x) => x.id !== candidateId));
    } catch {
      alert('Failed to remove');
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4">
      <header className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold">Interested Candidates</h1>
        <p className="text-sm text-gray-600">People you marked as interested.</p>
      </header>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {!loading && !items.length && (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">No likes yet. Go to <Link to="/discover" className="underline">Discover</Link> and click Interested.</div>
      )}

      <div className="grid gap-3">
        {items.map((u) => (
          <div key={u.id} className="rounded-xl border bg-white p-4 flex items-center gap-4">
            <img src={u.avatarUrl || 'https://via.placeholder.com/64'} alt={u.name} className="h-14 w-14 rounded-full object-cover border" />
            <div className="flex-1">
              <div className="font-semibold">{u.name}</div>
              <div className="text-sm text-gray-600">{u.headline || u.companyName || u.location || 'Candidate'}</div>
            </div>
            {u.videoUrl && (
              <video src={fileUrl(u.videoUrl)} className="hidden sm:block h-16 rounded border" muted playsInline preload="metadata" />
            )}
            <div className="flex items-center gap-2">
              <button onClick={() => goChat(u.id)} className="rounded-lg border px-3 py-2 text-sm">Chat</button>
              <button onClick={() => removeInterest(u.id)} className="rounded-lg border px-3 py-2 text-sm">Remove</button>
              <Link to={`/discover`} className="rounded-lg bg-gray-900 text-white px-3 py-2 text-sm">View More</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
