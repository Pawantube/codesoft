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

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeoutRef = useRef();

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

    return () => {
      socket.off('chat:new', handleNewMessage);
      socket.off('chat:poke', handlePoke);
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

  if (!user) {
    return <div className="p-6 text-sm text-gray-600">Login required to use chat.</div>;
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-12">
      <aside className="lg:col-span-4 space-y-4">
        <div className="rounded-xl border bg-white">
          <div className="border-b p-3 font-semibold">Find people</div>
          <div className="space-y-2 p-3">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            {searching && <div className="text-xs text-gray-500">Searching...</div>}
            {!searching && searchTerm.trim().length >= 2 && searchResults.length === 0 && (
              <div className="text-xs text-gray-500">No matching contacts.</div>
            )}
            <div className="max-h-56 space-y-2 overflow-auto">
              {searchResults.map((contact) => (
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

      <main className="lg:col-span-8 flex h-[70vh] flex-col rounded-xl border bg-white">
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
            </div>
          ) : (
            <div className="text-sm text-gray-500">Select a conversation to start messaging.</div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loadingMessages && <div className="text-sm text-gray-500">Loading messages...</div>}
          {!loadingMessages && messages.length === 0 && (
            <div className="text-sm text-gray-500">No messages yet.</div>
          )}
          {messages.map((message) => {
            const mine = String(message.sender) === String(user?._id);
            return (
              <div key={message._id} className={`mb-3 flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] rounded-2xl border px-4 py-2 ${
                    mine ? 'bg-gray-900 text-white' : 'bg-white'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">{message.body}</div>
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
      </main>
    </div>
  );
}





