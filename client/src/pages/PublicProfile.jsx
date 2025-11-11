import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export default function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([
        api.get(`/users/${id}`),
        api.get(`/users/${id}/posts`),
      ]);
      setProfile(u.data || null);
      setPosts(Array.isArray(p.data) ? p.data : []);
    } catch {
      setProfile(null);
      setPosts([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const follow = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      if (profile.isFollowing) await api.delete(`/users/${id}/follow`);
      else await api.post(`/users/${id}/follow`);
      await load();
    } catch {} finally { setBusy(false); }
  };

  if (loading) return <div className="p-4">Loading…</div>;
  if (!profile) return <div className="p-4">User not found</div>;

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-3">
          <img src={profile.avatarUrl || 'https://via.placeholder.com/64'} alt="" className="h-14 w-14 rounded-full object-cover border" />
          <div>
            <div className="text-lg font-semibold">{profile.name}</div>
            <div className="text-sm text-gray-600">{profile.headline || profile.role}</div>
          </div>
          <button onClick={follow} disabled={busy} className="ml-auto rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-50">
            {busy ? '...' : (profile.isFollowing ? 'Unfollow' : 'Follow')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-semibold mb-2">Posts</div>
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="rounded-lg border">
              <div className="p-3">
                <div className="text-sm font-semibold">{p.author?.name}</div>
                <div className="mt-1 text-sm whitespace-pre-wrap">{p.body}</div>
              </div>
              {p.mediaUrl && (
                <div className="bg-black">
                  {p.mediaType === 'video' ? (
                    <video src={p.mediaUrl} className="w-full max-h-[60vh]" controls playsInline />
                  ) : (
                    <img src={p.mediaUrl} alt="media" className="w-full max-h-[60vh] object-contain" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
