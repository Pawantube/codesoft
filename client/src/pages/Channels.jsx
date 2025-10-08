import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { getSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';

const defaultChannelPayload = {
  name: '',
  description: '',
  visibility: 'public',
  tags: '',
};

export default function Channels() {
  const { user } = useAuth();
  const [channels, setChannels] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const [creating, setCreating] = useState(false);
  const [newChannel, setNewChannel] = useState(defaultChannelPayload);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const bottomRef = useRef(null);
  const joinedRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState([]); // display names typing in current channel
  const [lastSeen, setLastSeen] = useState(() => {
    try {
      const raw = localStorage.getItem('channels:lastSeen');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedId) || null,
    [channels, selectedId]
  );

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const res = await api.get('/channels');
      const list = res.data || [];
      setChannels(list);
      if (!selectedId && list.length) {
        setSelectedId(list[0].id);
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || 'Unable to load channels');
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const ensureMembership = async (channelId) => {
    const channel = channels.find((ch) => ch.id === channelId);
    if (!channel || channel.isMember) return;
    try {
      await api.post(`/channels/${channelId}/join`);
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === channelId ? { ...ch, isMember: true, memberRole: 'member' } : ch
        )
      );
    } catch (err) {
      const msg = err?.response?.data?.error || 'Unable to join channel';
      // If key required, prompt once
      if (/Join key/i.test(msg)) {
        const key = window.prompt('This channel is private. Enter join key:');
        if (key) {
          const res = await api.post(`/channels/${channelId}/join?key=${encodeURIComponent(key)}`);
          if (res.data?.ok) {
            setChannels((prev) => prev.map((ch) => ch.id === channelId ? { ...ch, isMember: true, memberRole: res.data.role || 'member' } : ch));
            return;
          }
        }
      }
      throw new Error(msg);
    }
  };

  const loadMessages = async (channelId) => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/channels/${channelId}/messages`);
      setMessages(res.data || []);
      joinedRef.current = true;
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || 'Unable to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMessage = (payload) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === payload.id);
        return exists ? prev : [...prev, payload];
      });
      // Update lastMessageAt for unread badge
      setChannels((prev) => prev.map((ch) => ch.id === payload.channelId ? { ...ch, lastMessageAt: payload.createdAt } : ch));
    };
    const handleError = ({ channelId, error }) => {
      setError(error || 'Channel error');
    };
    const handleConnect = () => {
      if (selectedId) {
        socket.emit('channel:join', { channelId: selectedId });
      }
    };
    const handleTyping = ({ channelId, user: from }) => {
      if (!channelId || channelId !== selectedId) return;
      if (String(from?._id) === String(user?._id)) return; // ignore self
      const name = from?.name || 'Someone';
      setTypingUsers((prev) => {
        const set = new Set(prev);
        set.add(name);
        return Array.from(set);
      });
      // Clear after 3s of inactivity
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => setTypingUsers([]), 3000);
    };

    socket.on('channel:new-message', handleMessage);
    socket.on('channel:error', handleError);
    socket.on('connect', handleConnect);
    socket.on('reconnect', handleConnect);
    socket.on('channel:typing', handleTyping);
    return () => {
      socket.off('channel:new-message', handleMessage);
      socket.off('channel:error', handleError);
      socket.off('connect', handleConnect);
      socket.off('reconnect', handleConnect);
      socket.off('channel:typing', handleTyping);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    const run = async () => {
      try {
        await ensureMembership(selectedId);
        await loadMessages(selectedId);
        getSocket()?.emit('channel:join', { channelId: selectedId });
      } catch (err) {
        setError(err.message);
      }
    };

    run();

    return () => {
      getSocket()?.emit('channel:leave', { channelId: selectedId });
      setMessages([]);
      joinedRef.current = false;
      setTypingUsers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = async () => {
    if (!messageBody.trim() || !selectedChannel) return;
    const body = messageBody.trim();
    setMessageBody('');
    try {
      const res = await api.post(`/channels/${selectedChannel.id}/messages`, { body });
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === res.data.id);
        return exists ? prev : [...prev, res.data];
      });
      // Touch lastMessageAt
      setChannels((prev) => prev.map((ch) => ch.id === selectedChannel.id ? { ...ch, lastMessageAt: res.data.createdAt } : ch));
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || 'Unable to send message');
    }
  };

  // Emit typing event as user types
  const onType = (val) => {
    setMessageBody(val);
    const socket = getSocket();
    if (socket && selectedChannel) {
      socket.emit('channel:typing', { channelId: selectedChannel.id });
    }
  };

  // Persist last seen and compute unread badge
  useEffect(() => {
    if (!selectedId) return;
    const now = new Date().toISOString();
    setLastSeen((prev) => {
      const next = { ...prev, [selectedId]: now };
      try { localStorage.setItem('channels:lastSeen', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [selectedId, messages.length]);

  const createChannel = async (event) => {
    event.preventDefault();
    if (!newChannel.name.trim()) {
      setError('Channel name is required');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        name: newChannel.name,
        description: newChannel.description,
        visibility: newChannel.visibility,
        tags: newChannel.tags
          ? newChannel.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : [],
      };
      const res = await api.post('/channels', payload);
      setChannels((prev) => [res.data, ...prev]);
      setNewChannel(defaultChannelPayload);
      setSelectedId(res.data.id);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || 'Unable to create channel');
    } finally {
      setCreating(false);
    };
  };

  const leaveChannel = async (channelId) => {
    try {
      await api.post(`/channels/${channelId}/leave`);
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === channelId ? { ...ch, isMember: false, memberRole: null } : ch
        )
      );
      if (selectedId === channelId) {
        setSelectedId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.error || 'Unable to leave channel');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:flex-row">
      <aside className="w-full space-y-4 lg:w-64">
        <form
          onSubmit={createChannel}
          className="space-y-3 rounded-xl border bg-white p-4 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-gray-700">Create Channel</h2>
          <input
            value={newChannel.name}
            onChange={(e) => setNewChannel((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Channel name"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            required
          />
          <textarea
            value={newChannel.description}
            onChange={(e) =>
              setNewChannel((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Description"
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={newChannel.visibility}
            onChange={(e) =>
              setNewChannel((prev) => ({ ...prev, visibility: e.target.value }))
            }
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="public">Public</option>
            <option value="private">Private (invited only)</option>
            <option value="company">Company</option>
          </select>
          <input
            value={newChannel.tags}
            onChange={(e) =>
              setNewChannel((prev) => ({ ...prev, tags: e.target.value }))
            }
            placeholder="Tags (comma separated)"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>

        <div className="space-y-2 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Channels</h2>
            <button
              onClick={loadChannels}
              className="text-xs text-blue-600 underline disabled:opacity-50"
              disabled={loadingChannels}
            >
              Refresh
            </button>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />

          {loadingChannels && (
            <div className="text-xs text-gray-500">Loading channels…</div>
          )}

          <div className="space-y-2">
            {channels
              .filter((c) => {
                const q = query.trim().toLowerCase();
                if (!q) return true;
                return (
                  c.name.toLowerCase().includes(q) ||
                  (c.description || '').toLowerCase().includes(q) ||
                  (c.tags || []).join(',').toLowerCase().includes(q)
                );
              })
              .map((channel) => (
              <button
                key={channel.id}
                onClick={() => setSelectedId(channel.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  channel.id === selectedId ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{channel.name}</span>
                  <span className="text-[10px] uppercase text-gray-400">
                    {channel.visibility}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500 line-clamp-2">
                  {channel.description || 'No description'}
                </div>
                <div className="mt-1 text-[10px] text-gray-400">
                  {channel.memberCount} members
                </div>
              </button>
            ))}
            {!channels.length && !loadingChannels && (
              <div className="text-xs text-gray-500">No channels found.</div>
            )}
          </div>
        </div>
      </aside>

      <section className="flex-1 rounded-xl border bg-white shadow-sm">
        {selectedChannel ? (
          <div className="flex h-[70vh] flex-col">
            <header className="border-b px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {selectedChannel.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedChannel.description || 'No description provided.'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                {selectedChannel.isMember && selectedChannel.memberRole !== 'owner' && (
                  <button
                    onClick={() => leaveChannel(selectedChannel.id)}
                    className="rounded-lg border px-3 py-1 text-sm text-gray-700"
                  >
                    Leave
                  </button>
                )}
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/channels?c=${selectedChannel.id}`)}
                    className="rounded-lg border px-3 py-1 text-sm text-gray-700"
                  >
                    Share
                  </button>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-auto px-4 py-3">
              {loadingMessages && (
                <div className="text-sm text-gray-500">Loading messages…</div>
              )}
              {!loadingMessages && !messages.length && (
                <div className="text-sm text-gray-500">
                  No messages yet. Start the conversation!
                </div>
              )}
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={`${message.id}-${message.createdAt}`} className="rounded-lg border px-3 py-2">
                    <div className="text-sm font-semibold text-gray-800">
                      {message.author?.name || 'Unknown'}{' '}
                      <span className="text-xs text-gray-400">
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                      {message.body}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </main>

            {selectedChannel.isMember ? (
              <footer className="border-t bg-gray-50 px-4 py-3">
                <div className="flex gap-2">
                  <textarea
                    value={messageBody}
                    onChange={(e) => onType(e.target.value)}
                    rows={2}
                    className="flex-1 rounded-lg border px-3 py-2 text-sm"
                    placeholder="Share an update or ask a question…"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageBody.trim()}
                    className="h-10 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </footer>
            ) : (
              <footer className="border-t bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Join this channel to start participating.
              </footer>
            )}
          </div>
        ) : (
          <div className="flex h-[70vh] items-center justify-center text-sm text-gray-500">
            Select a channel to view conversations.
          </div>
        )}
      </section>

      {error && (
        <div className="fixed bottom-4 right-4 max-w-sm rounded-lg border bg-white px-4 py-3 text-sm text-red-600 shadow-lg">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-2 text-xs text-gray-500 underline"
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
