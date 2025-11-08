import { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { fileUrl } from '../utils/fileUrl';

const FALLBACK_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 64 64">
      <rect width="64" height="64" fill="#e5e7eb"/>
      <circle cx="32" cy="24" r="12" fill="#9ca3af"/>
      <rect x="12" y="42" width="40" height="14" rx="7" fill="#9ca3af"/>
    </svg>`
  );

export default function Posts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modWarning, setModWarning] = useState(null); // { reasons:[], categories:[] }
  const [q, setQ] = useState('');
  const [commentsOpen, setCommentsOpen] = useState({}); // id -> bool
  const [comments, setComments] = useState({}); // id -> list
  const [commentText, setCommentText] = useState({}); // id -> text
  const bottomRef = useRef(null);

  const load = async (opts = {}) => {
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (opts.before) params.set('before', opts.before);
      const res = await api.get(`/posts?${params.toString()}`);
      setPosts(res.data || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Unable to load posts');
    }
  };

  const loadComments = async (postId) => {
    setCommentsOpen((p) => ({ ...p, [postId]: !p[postId] }));
    if (comments[postId]) return; // already loaded
    try {
      const res = await api.get(`/posts/${postId}/comments`);
      setComments((c) => ({ ...c, [postId]: res.data || [] }));
    } catch {}
  };

  const addComment = async (postId) => {
    const text = (commentText[postId] || '').trim();
    if (!text) return;
    const optimistic = { id: 'temp-' + Date.now(), body: text, author: { name: user?.name, avatarUrl: user?.avatarUrl } };
    setComments((c) => ({ ...c, [postId]: [...(c[postId] || []), optimistic] }));
    setCommentText((t) => ({ ...t, [postId]: '' }));
    try {
      const res = await api.post(`/posts/${postId}/comments`, { body: text });
      setComments((c) => ({ ...c, [postId]: (c[postId] || []).map((x) => (x.id === optimistic.id ? res.data : x)) }));
    } catch {
      // revert on failure
      setComments((c) => ({ ...c, [postId]: (c[postId] || []).filter((x) => x.id !== optimistic.id) }));
      alert('Failed to comment');
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const submit = async () => {
    const text = body.trim();
    if (!text && !file) return;
    setBusy(true);
    setError('');
    try {
      // Moderation pre-check (soft)
      if (text) {
        try {
          const res = await api.post('/moderate', { content: text, type: 'post' });
          if (res.data?.unsafe) {
            setModWarning({ reasons: res.data.reasons || [], categories: res.data.categories || [] });
            setBusy(false);
            return; // user can proceed after warning by clicking Post again
          }
        } catch {}
      }
      const form = new FormData();
      if (text) form.append('body', text);
      if (file) form.append('media', file);
      const res = await api.post('/posts', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPosts((prev) => [res.data, ...prev]);
      setBody('');
      setFile(null);
      setModWarning(null);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to publish');
    } finally {
      setBusy(false);
    }
  };

  const like = async (id) => {
    try {
      const res = await api.post(`/posts/${id}/like`);
      setPosts((prev) => prev.map((p) => (p._id === id || p.id === id ? { ...p, likes: new Array(res.data.likes).fill(0) } : p)));
    } catch {}
  };

  const remove = async (id) => {
    if (!confirm('Delete this post?')) return;
    try {
      await api.delete(`/posts/${id}`);
      setPosts((prev) => prev.filter((p) => (p._id || p.id) !== id));
    } catch (e) {
      setError(e?.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-lg font-semibold mb-2">Create Post</h1>
        {modWarning && (
          <div className="mb-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            <div className="font-semibold">Warning: your post may violate content guidelines.</div>
            {modWarning.reasons?.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {modWarning.reasons.slice(0,3).map((r,i)=>(<li key={i}>{r}</li>))}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <button onClick={()=>setModWarning(null)} className="rounded border px-2 py-1">Edit</button>
              <button onClick={()=>{ setModWarning(null); submit(); }} className="rounded bg-gray-900 px-2 py-1 text-white">Post anyway</button>
            </div>
          </div>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Share an update..."
        />
        <div className="mt-2 flex items-center gap-2">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button
            onClick={submit}
            disabled={busy || (!body.trim() && !file)}
            className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
          >
            {busy ? 'Posting…' : 'Post'}
          </button>
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Feed</h2>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search posts"
              className="rounded border px-2 py-1 text-sm"
            />
            <button onClick={() => load()} className="text-sm underline">Search</button>
          </div>
        </div>
        <div className="space-y-3">
          {posts.map((p) => {
            const id = p._id || p.id;
            return (
              <div key={id} className="rounded-lg border">
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
                <div className="p-3 flex items-center gap-3 text-sm">
                  <button onClick={() => like(id)} className="underline">Like</button>
                  <span>{Array.isArray(p.likes) ? p.likes.length : 0} likes</span>
                  <button onClick={() => loadComments(id)} className="underline">Comments ({p.commentsCount || (comments[id]?.length||0)})</button>
                  <button onClick={() => remove(id)} className="ml-auto text-red-600 underline">Delete</button>
                </div>
                {commentsOpen[id] && (
                  <div className="border-t p-3 space-y-3 text-sm">
                    <div className="space-y-2">
                      {(comments[id] || []).map((c) => {
                        const raw = c.author?.avatarUrl || '';
                        const src = raw ? (/^https?:\/\//i.test(raw) ? raw : fileUrl(raw)) : FALLBACK_AVATAR;
                        return (
                          <div key={c.id} className="flex items-start gap-2">
                            <img
                              src={src}
                              alt=""
                              className="h-6 w-6 rounded-full object-cover border"
                              onError={(e) => { if (e.currentTarget.src !== FALLBACK_AVATAR) e.currentTarget.src = FALLBACK_AVATAR; }}
                            />
                            <div>
                              <div className="font-medium">{c.author?.name || 'User'}</div>
                              <div>{c.body}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={commentText[id] || ''}
                        onChange={(e) => setCommentText((t) => ({ ...t, [id]: e.target.value }))}
                        placeholder="Write a comment..."
                        className="flex-1 rounded border px-3 py-2"
                      />
                      <button onClick={() => addComment(id)} className="px-2 py-1 rounded bg-gray-900 text-white">Send</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
