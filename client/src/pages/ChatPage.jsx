import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { initSocket, getSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const formatDate = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
};

export default function ChatPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const activeConversationRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [text, setText] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null); // { applicationId, from }
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef();

  const [searchRoleFilter, setSearchRoleFilter] = useState('all'); // all | candidate | employer | team
  const [searchJobFilter, setSearchJobFilter] = useState('');
  const [sendingCall, setSendingCall] = useState(false);
  // Removed inline modal approach; we navigate to /call/:id for full-screen

  const bottomRef = useRef(null);
  const initialConversationRef = useRef(new URLSearchParams(location.search).get('c'));

  const loadConversations = useCallback(async () => {
    if (!token) return [];
    try {
      const res = await fetch(`${API_URL}/api/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      const safe = Array.isArray(data) ? data : [];
      setConversations(safe);
      return safe;
    } catch (error) {
      console.error(error);
      setConversations([]);
      return [];
    }
  }, [token]);

  const loadMessages = useCallback(async (conversationId) => {
    if (!token || !conversationId) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(`${API_URL}/api/chat/messages?conversationId=${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [token]);

  const markConversationRead = useCallback(async (conversationId) => {
    if (!token || !conversationId) return;
    try {
      await fetch(`${API_URL}/api/chat/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ conversationId })
      });
    } catch (error) {
      console.error(error);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    initSocket(token);
    loadConversations().then((data) => {
      const initial = initialConversationRef.current;
      if (initial) {
        setActiveConversationId(initial);
        initialConversationRef.current = null;
      } else if (data.length) {
        setActiveConversationId((prev) => prev || data[0]._id);
      }
    });
  }, [token, loadConversations]);

  useEffect(() => {
    activeConversationRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    const socket = getSocket();
    if (socket) {
      socket.emit('chat:join', activeConversationId);
    }
    loadMessages(activeConversationId).then(() => markConversationRead(activeConversationId));

    const params = new URLSearchParams(location.search);
    if (activeConversationId !== params.get('c')) {
      params.set('c', activeConversationId);
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [activeConversationId, loadMessages, markConversationRead, location.search, navigate]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = ({ conversationId, message }) => {
      if (activeConversationRef.current === conversationId) {
        setMessages((prev) => [...prev, message]);
        markConversationRead(conversationId);
      }
      loadConversations();
    };

    const handlePoke = () => {
      loadConversations();
    };

    socket.on('chat:new', handleNewMessage);
    socket.on('chat:poke', handlePoke);
    const handleRing = ({ applicationId, from }) => {
      setIncomingCall({ applicationId, from });
    };
    socket.on('call:ring', handleRing);

    return () => {
      socket.off('chat:new', handleNewMessage);
      socket.off('chat:poke', handlePoke);
      socket.off('call:ring', handleRing);
    };
  }, [loadConversations, markConversationRead]);

  useEffect(() => {
    const term = searchTerm.trim();
    if (!token || term.length < 2) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/chat/search?q=${encodeURIComponent(term)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const activeConversation = useMemo(
    () => conversations.find((convo) => convo._id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !activeConversationId || !token) return;
    try {
      await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ conversationId: activeConversationId, body: trimmed })
      });
      setText('');
    } catch (error) {
      console.error(error);
    }
  };

  const startConversation = async (contact) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/chat/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ applicationId: contact.applicationId, otherUserId: contact.userId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unable to start chat' }));
        throw new Error(err?.error || 'Unable to start chat');
      }
      const convo = await res.json();
      setSearchTerm('');
      setSearchResults([]);
      setSearching(false);
      loadConversations().then(() => {
        setActiveConversationId(convo._id);
      });
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  // Send a call link in the current conversation and copy it (component scope)
  const startCall = async () => {
    if (!activeConversationId || !token || sendingCall) return;
    setSendingCall(true);
    const appId = activeConversation?.applicationId;
    if (!appId) {
      alert('This conversation is not linked to an application.');
      setSendingCall(false);
      return;
    }
    const callUrl = `${window.location.origin}/call/${appId}`;
    const msg = `Join video call: ${callUrl}`;
    try {
      await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversationId: activeConversationId, body: msg })
      });
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(callUrl);
      }
      // notify other participant about the call
      const targetUserId = activeConversation?.otherParticipant?.id || activeConversation?.otherParticipant?._id;
      if (targetUserId) {
        getSocket()?.emit('call:ring', { applicationId: appId, targetUserId });
      }
      // Fallback broadcast ring (candidate, employer, team)
      getSocket()?.emit('call:ring-app', { applicationId: appId });
      // Navigate initiator to the call page (full-screen flow)
      navigate(`/call/${appId}`);
    } catch (e) {
      console.error(e);
      alert('Failed to start call');
    } finally { setSendingCall(false); }
  };

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-12">
      <aside className="lg:col-span-4 space-y-4">
        <div className="rounded-xl border bg-white">
          <div className="border-b p-3 font-semibold">Find people</div>
          <div className="space-y-2 p-3">
            {user?.role === 'employer' && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-[12px] text-blue-800">
                You can search candidates from your job applications by name or email. Results only include candidates who applied to your jobs.
              </div>
            )}
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <div className="flex gap-2 text-xs">
              <select
                value={searchRoleFilter}
                onChange={(e) => setSearchRoleFilter(e.target.value)}
                className="rounded border px-2 py-1"
              >
                <option value="all">All</option>
                <option value="candidate">Candidates</option>
                <option value="employer">Employers</option>
                <option value="team">Team</option>
              </select>
              <input
                value={searchJobFilter}
                onChange={(e) => setSearchJobFilter(e.target.value)}
                className="flex-1 rounded border px-2 py-1"
                placeholder="Filter by job title/company"
              />
            </div>
            {searching && <div className="text-xs text-gray-500">Searching...</div>}
            {!searching && searchTerm.trim().length >= 2 && searchResults.length === 0 && (
              <div className="text-xs text-gray-500">No matching contacts.</div>
            )}
            <div className="max-h-56 space-y-2 overflow-auto">
              {searchResults
                .filter((c) => searchRoleFilter === 'all' || c.relation === searchRoleFilter)
                .filter((c) => {
                  const f = searchJobFilter.trim().toLowerCase();
                  if (!f) return true;
                  const title = (c.job?.title || '').toLowerCase();
                  const company = (c.job?.company || '').toLowerCase();
                  return title.includes(f) || company.includes(f);
                })
                .map((contact) => (
                <button
                  key={`${contact.userId}-${contact.applicationId}`}
                  onClick={() => startConversation(contact)}
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <div className="font-semibold text-gray-900">{contact.name}</div>
                  <div className="text-xs text-gray-500">{contact.email}</div>
                  {contact.job && (
                    <div className="mt-1 text-xs text-gray-600">
                      {contact.job.title}
                      {contact.job.company ? ` - ${contact.job.company}` : ''}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">{contact.relation}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white">
          <div className="border-b p-3 font-semibold">Conversations</div>
          <div className="max-h-[60vh] divide-y overflow-auto">
            {conversations.map((convo) => (
              <button
                key={convo._id}
                onClick={() => setActiveConversationId(convo._id)}
                className={`w-full px-3 py-3 text-left text-sm hover:bg-gray-100 ${
                  convo._id === activeConversationId ? 'bg-gray-50 font-medium' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{convo.otherParticipant?.name || 'Conversation'}</span>
                  <span className="text-[10px] text-gray-400">{formatDate(convo.lastMessageAt)}</span>
                </div>
                {convo.job && (
                  <div className="text-xs text-gray-500">
                    {convo.job.title} - {convo.job.company}
                  </div>
                )}
                {convo.lastMessage && (
                  <div className="mt-1 truncate text-xs text-gray-600">
                    {convo.lastMessage.body || '[Attachment]'}
                  </div>
                )}
              </button>
            ))}
            {conversations.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500">No conversations yet.</div>
            )}
          </div>
        </div>
      </aside>

      <main className="lg:col-span-8 relative flex h-[70vh] flex-col rounded-xl border bg-white">
        <div className="border-b p-4">
          {activeConversation ? (
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {activeConversation.otherParticipant?.name || 'Conversation'}
              </div>
              {activeConversation.job && (
                <div className="text-sm text-gray-500">
                  {activeConversation.job.title} - {activeConversation.job.company}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <button onClick={startCall} disabled={sendingCall} className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${sendingCall ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600'}`}>
                  {sendingCall ? 'Sending…' : 'Start Video Call'}
                </button>
                <a
                  href={`/call/${activeConversation?.applicationId || ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border px-3 py-1.5 text-xs"
                >
                  Open Call
                </a>
                <button
                  onClick={() => setShowProfile(true)}
                  className="rounded-lg border px-3 py-1.5 text-xs"
                >
                  View Profile
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Select a conversation to start messaging.</div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {incomingCall && (
            <div className="mb-3 rounded-lg border bg-yellow-50 p-3 text-sm text-gray-800">
              <div className="flex items-center justify-between">
                <div>Incoming call</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const appId = incomingCall.applicationId;
                      setIncomingCall(null);
                      navigate(`/call/${appId}`);
                    }}
                    className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setIncomingCall(null)}
                    className="rounded border px-3 py-1 text-xs"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          )}
          {loadingMessages && <div className="text-sm text-gray-500">Loading messages...</div>}
          {!loadingMessages && messages.length === 0 && (
            <div className="text-sm text-gray-500">No messages yet.</div>
          )}
          {messages.map((message) => {
            const mine = String(message.sender) === String(user?._id);
            const body = String(message.body || '');
            // Match either '/call/:id' or any full URL that ends with /call/:id
            const callMatch = body.match(/\b\/call\/([A-Za-z0-9_-]+)\b|\bhttps?:\/\/[^\s]*\/call\/([A-Za-z0-9_-]+)\b/);
            const appId = callMatch ? (callMatch[1] || callMatch[2]) : null;
            return (
              <div key={message._id} className={`mb-3 flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] rounded-2xl border px-4 py-2 ${
                    mine ? 'bg-gray-900 text-white' : 'bg-white'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {body}
                    {appId && (
                      <button
                        className={`ml-2 underline ${mine ? 'text-white' : 'text-blue-600'}`}
                        onClick={() => navigate(`/call/${appId}`)}
                      >
                        Join video call
                      </button>
                    )}
                  </div>
                  <div className="mt-1 text-[10px] opacity-60">{formatDate(message.createdAt)}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={!activeConversationId}
              placeholder={activeConversationId ? 'Type a message...' : 'Select a conversation to start chatting'}
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
            />
            <button
              onClick={handleSend}
              disabled={!activeConversationId || !text.trim()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>

        {showProfile && activeConversation && (
          <div className="absolute right-0 top-0 h-full w-full max-w-sm border-l bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-sm font-semibold">Profile</div>
              <button
                onClick={() => setShowProfile(false)}
                className="rounded border px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div>
                <div className="text-base font-semibold">{activeConversation.otherParticipant?.name || 'User'}</div>
                {activeConversation.otherParticipant?.role && (
                  <div className="text-xs text-gray-500">{activeConversation.otherParticipant.role}</div>
                )}
              </div>
              {activeConversation.job && (
                <div className="rounded-lg border p-3 bg-gray-50">
                  <div className="text-xs text-gray-500">Associated Job</div>
                  <div className="text-sm font-medium">{activeConversation.job.title}</div>
                  {activeConversation.job.company && (
                    <div className="text-xs text-gray-600">{activeConversation.job.company}</div>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-500">Application ID</div>
              <div className="rounded border p-2 text-xs break-all">{activeConversation.applicationId}</div>
              <div className="pt-2">
                <button
                  onClick={() => navigate(`/call/${activeConversation?.applicationId || ''}`)}
                  className="inline-block rounded-lg border px-3 py-1.5 text-xs"
                >
                  Open Call
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Inline call modal removed for consistent full-screen experience */}
      </main>
    </div>
  );
}





