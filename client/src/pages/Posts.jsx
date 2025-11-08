import { useEffect, useRef, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { fileUrl, sanitizeUrl } from '../utils/fileUrl';

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
{{ ... }}
                  <button onClick={() => remove(id)} className="ml-auto text-red-600 underline">Delete</button>
                </div>
                {commentsOpen[id] && (
                  <div className="border-t p-3 space-y-3 text-sm">
                    <div className="space-y-2">
 186→                      {(comments[id] || []).map((c) => {
 187→                        const raw = c.author?.avatarUrl || '';
 188→                        const src = raw
 189→                          ? (/^https?:\/\//i.test(raw) ? raw : fileUrl(raw))
 190→                          : FALLBACK_AVATAR;
 191→                        return (
 192→                          <div key={c.id} className="flex items-start gap-2">
 193→                            <img
 194→                              src={src}
 195→                              alt=""
 196→                              className="h-6 w-6 rounded-full object-cover border"
 197→                              onError={(e) => { if (e.currentTarget.src !== FALLBACK_AVATAR) e.currentTarget.src = FALLBACK_AVATAR; }}
 198→                            />
 199→                            <div>
 200→                              <div className="font-medium">{c.author?.name || 'User'}</div>
 201→                              <div>{c.body}</div>
 202→                            </div>
 203→                          </div>
 204→                        );
 205→                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={commentText[id] || ''}
                        onChange={(e) => setCommentText((t) => ({ ...t, [id]: e.target.value }))}
{{ ... }}
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
