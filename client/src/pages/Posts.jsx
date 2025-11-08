import { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
// no file helpers needed in minimal version

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
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts.length]);

  const addPost = async (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    // Optimistic local add; wire to API when backend is ready
    const item = {
      id: Date.now(),
      author: { name: user?.name || 'You', avatarUrl: '' },
      body: trimmed,
      createdAt: new Date().toISOString(),
    };
    setPosts((p) => [item, ...p]);
    setBody('');
  };

  const remove = (id) => setPosts((p) => p.filter((x) => x.id !== id));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Posts</h1>
      <form onSubmit={addPost} className="rounded-xl border bg-white p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share an update..."
          className="w-full resize-y rounded border px-3 py-2"
          rows={3}
        />
        <div className="mt-2 flex justify-end">
          <button className="rounded bg-gray-900 px-4 py-2 text-white">Post</button>
        </div>
      </form>

      <div className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="rounded-xl border bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <img
                src={FALLBACK_AVATAR}
                alt=""
                className="h-8 w-8 rounded-full border object-cover"
              />
              <div>
                <div className="text-sm font-medium">{p.author?.name || 'User'}</div>
                <div className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleString()}</div>
              </div>
              <button onClick={() => remove(p.id)} className="ml-auto text-sm text-red-600 underline">Delete</button>
            </div>
            <div className="whitespace-pre-wrap text-sm">{p.body}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
