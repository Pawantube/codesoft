import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket, initSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { showToast } from '../utils/toast';
import TabBar from '../components/livecall/TabBar';
import ScorecardPane from '../components/livecall/ScorecardPane';
import CallHeader from '../components/livecall/CallHeader';
import VideoPane from '../components/livecall/VideoPane';
import CodePane from '../components/livecall/CodePane';
import WhiteboardPane from '../components/livecall/WhiteboardPane';
import NotesPane from '../components/livecall/NotesPane';

// Inline client-side defaults (PUBLIC values only)
// Do NOT place server secrets in the client.
const CLIENT_ENV = {
  // Keep this false by default — client should not call Metered directly with a key.
  VITE_ENABLE_METERED: (import.meta.env.VITE_ENABLE_METERED ?? 'false'),
  VITE_METERED_SUBDOMAIN: (import.meta.env.VITE_METERED_SUBDOMAIN ?? 'sawconnect'),
  VITE_METERED_API_KEY: (import.meta.env.VITE_METERED_API_KEY ?? 'fe4tvbmXP7i4yKIXlcdaA0vfl4Z65TZ9e3yDgDDiN8sNfveF'),
  VITE_API_URL: (import.meta.env.VITE_API_URL ?? 'http://localhost:5000'),
};

export default function LiveCallPage() {
  const { id: applicationId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [tab, setTab] = useState('video'); // 'video' | 'code' | 'whiteboard' | 'notes'
  const [code, setCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [noteTag, setNoteTag] = useState('general'); // 'general' | 'strength' | 'concern' | 'next_step'
  const [noteFilter, setNoteFilter] = useState('all');
  const [transcriptText, setTranscriptText] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [questions, setQuestions] = useState([]); // [{id,text,weight,category}]
  const [scorecard, setScorecard] = useState(null); // {overallScore, summary, criteria[]}
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [transcriptSavedAt, setTranscriptSavedAt] = useState(null);
  const [calendarMeta, setCalendarMeta] = useState(null);
  const [recording, setRecording] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [participantsCount, setParticipantsCount] = useState(1);
  const [socketId, setSocketId] = useState('');
  const [isLeader, setIsLeader] = useState(false);
  const [iceSource, setIceSource] = useState(''); // 'server' | 'metered' | 'env'

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const audioMixContextRef = useRef(null);
  const audioDestRef = useRef(null);
  const transcriptSaveTimer = useRef(null);
  const codeSaveTimer = useRef(null);
  const wbSaveTimer = useRef(null);

  const joinRef = useRef(null);
  const joinCleanupRef = useRef(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const otherUserIdRef = useRef(null);

  // Perfect negotiation refs
  const roleRef = useRef('participant');
  const politeRef = useRef(true);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const settingRemoteAnswerPendingRef = useRef(false);
  const pendingIceRef = useRef([]);

  // Whiteboard
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  // Init socket once token available
  useEffect(() => { if (token) initSocket(token); }, [token]);

  // Track socket id for diagnostics
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const update = () => setSocketId(String(s.id || ''));
    update();
    s.on && s.on('connect', update);
    if (import.meta.env.DEV && s.on) {
      const onErr = (e) => { try { console.warn('[socket] connect_error', e?.message || e); } catch {} };
      s.on('connect_error', onErr);
      return () => { try { s.off && s.off('connect', update); s.off && s.off('connect_error', onErr); } catch {} };
    }
    return () => { try { s.off && s.off('connect', update); } catch {} };
  }, [token]);

  // ---------- Recording helpers (top-level; NOT inside join) ----------
  const buildMixedAudioStream = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioMixContextRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();
      audioDestRef.current = dest;

      const addSrc = (stream) => {
        if (!stream) return;
        const tracks = stream.getAudioTracks();
        if (!tracks || tracks.length === 0) return;
        const src = ctx.createMediaStreamSource(stream);
        src.connect(dest);
      };

      // local mic
      if (localStreamRef.current) addSrc(localStreamRef.current);
      // remote audio (if any)
      const remoteStream = remoteVideoRef.current?.srcObject;
      if (remoteStream) addSrc(remoteStream);

      return dest.stream;
    } catch {
      return null;
    }
  };

  const uploadAudioBlob = async (blob, filename = 'audio.webm') => {
    try {
      setUploadingAudio(true);
      const fd = new FormData();
      fd.append('audio', blob, filename);
      const res = await api.post(`/interview/${applicationId}/transcribe`, fd);
      const updated = res?.data?.transcriptText || '';
      if (updated) setTranscriptText(updated);
      // Auto-trigger summary + scorecard if transcript is long enough
      try {
        const MIN_LEN = 400; // characters
        if ((updated || '').length >= MIN_LEN) {
          // summarize
          setSummarizing(true);
          const sres = await api.post(`/interview/${applicationId}/summarize`);
          if (sres?.data?.summaryText) setSummaryText(sres.data.summaryText);
          setSummarizing(false);
          // scorecard
          setScoring(true);
          const cres = await api.post(`/interview/${applicationId}/scorecard`, {});
          if (cres?.data?.scorecard) setScorecard(cres.data.scorecard);
          setScoring(false);
        }
      } catch {
        setSummarizing(false);
        setScoring(false);
      }
    } catch (e) {
      showToast({ title: 'Transcription failed', message: e?.response?.data?.error || 'Please try again.' });
    } finally {
      setUploadingAudio(false);
    }
  };

  const startRecording = async () => {
    if (recording) return;
    const mixed = buildMixedAudioStream();
    if (!mixed) { showToast({ title: 'Recording error', message: 'AudioContext not available' }); return; }
    try {
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(mixed, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        await uploadAudioBlob(blob, 'recording.webm');
      };
      mr.start(250);
      setRecording(true);
    } catch {
      showToast({ title: 'Recording failed', message: 'Try again or upload audio manually.' });
    }
  };

  const stopRecording = () => {
    try { mediaRecorderRef.current?.stop(); } catch {}
    setRecording(false);
    try { audioMixContextRef.current?.close(); } catch {}
    audioMixContextRef.current = null;
    audioDestRef.current = null;
  };

  const onAudioFilePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadAudioBlob(file, file.name || 'audio.webm');
  };
  // -------------------------------------------------------------------

  // Debounced autosave for transcript
  useEffect(() => {
    if (!transcriptText) return;
    if (transcriptSaveTimer.current) clearTimeout(transcriptSaveTimer.current);
    transcriptSaveTimer.current = setTimeout(async () => {
      try {
        await api.post(`/interview/${applicationId}/transcript`, { transcriptText });
        setTranscriptSavedAt(new Date());
      } catch {}
    }, 1200);
    return () => { if (transcriptSaveTimer.current) clearTimeout(transcriptSaveTimer.current); };
  }, [transcriptText, applicationId]);

  // Calendar meta
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const res = await api.get(`/interview/${applicationId}/meta`);
        setCalendarMeta(res.data || null);
      } catch { setCalendarMeta(null); }
    };
    loadMeta();
  }, [applicationId]);

  const fmtGoogleDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n)=>String(n).padStart(2,'0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  };
  const googleUrl = calendarMeta ?
    `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calendarMeta.title||'Interview')}&dates=${fmtGoogleDate(calendarMeta.at)}/${fmtGoogleDate(calendarMeta.end)}&details=${encodeURIComponent(calendarMeta.description||'')}&location=${encodeURIComponent(calendarMeta.location||'')}`
    : null;
  const outlookUrl = calendarMeta ?
    `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(calendarMeta.title||'Interview')}&body=${encodeURIComponent(calendarMeta.description||'')}&startdt=${encodeURIComponent(calendarMeta.at||'')}&enddt=${encodeURIComponent(calendarMeta.end||'')}&location=${encodeURIComponent(calendarMeta.location||'')}`
    : null;

  // Code editor emit
  const emitCode = (next) => {
    setCode(next);
    try { getSocket()?.emit('code:update', { applicationId, content: next }); } catch {}
  };

  // Ensure a CodingSession exists and load snapshots
  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const res = await api.post('/coding-sessions', { applicationId, language: 'javascript' });
    const s = res.data || {};
    setSessionId(String(s._id || ''));
    if (typeof s.code === 'string') setCode(s.code);
    return String(s._id || '');
  };

  // Debounce-persist code to server when on Code tab
  useEffect(() => {
    if (tab !== 'code' || !sessionId) return;
    if (codeSaveTimer.current) clearTimeout(codeSaveTimer.current);
    codeSaveTimer.current = setTimeout(async () => {
      try { await api.patch(`/coding-sessions/${sessionId}/code`, { code }); } catch {}
    }, 800);
    return () => { if (codeSaveTimer.current) clearTimeout(codeSaveTimer.current); };
  }, [code, tab, sessionId]);

  // Whiteboard helpers
  const getCtx = () => canvasRef.current?.getContext('2d') || null;
  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = getCtx(); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  const loadWhiteboardSnapshot = async () => {
    try {
      const id = await ensureSession();
      if (!id) return;
      const res = await api.get(`/coding-sessions/${id}`);
      const snap = res.data?.whiteboard;
      if (snap && typeof snap === 'string') {
        const img = new Image();
        img.onload = () => {
          const ctx = getCtx(); if (!ctx) return;
          ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        };
        img.src = snap;
      }
    } catch {}
  };
  const drawStroke = (stroke) => {
    const ctx = getCtx(); if (!ctx) return;
    const { x0, y0, x1, y1, color = '#111', width = 2 } = stroke || {};
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };
  const emitStroke = (stroke) => {
    drawStroke(stroke);
    try { getSocket()?.emit('wb:stroke', { applicationId, stroke }); } catch {}
    scheduleSaveWhiteboard();
  };
  const onCanvasDown = (e) => {
    drawingRef.current = true;
    const rect = e.target.getBoundingClientRect();
    lastPointRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onCanvasMove = (e) => {
    if (!drawingRef.current) return;
    const rect = e.target.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const lp = lastPointRef.current;
    emitStroke({ x0: lp.x, y0: lp.y, x1: p.x, y1: p.y, color: '#111', width: 2 });
    lastPointRef.current = p;
  };
  const onCanvasUp = () => { drawingRef.current = false; };
  const onClearBoard = () => {
    clearCanvas();
    try { getSocket()?.emit('wb:clear', { applicationId }); } catch {}
    scheduleSaveWhiteboard(true);
  };
  const scheduleSaveWhiteboard = (immediate = false) => {
    if (!sessionId) return;
    if (wbSaveTimer.current) clearTimeout(wbSaveTimer.current);
    const fire = async () => {
      try {
        const dataUrl = canvasRef.current?.toDataURL('image/png') || '';
        await api.patch(`/coding-sessions/${sessionId}/whiteboard`, { whiteboard: dataUrl });
      } catch {}
    };
    if (immediate) fire(); else wbSaveTimer.current = setTimeout(fire, 1500);
  };

  // When switching tabs, ensure session and load snapshots as needed
  useEffect(() => {
    if (tab === 'code') { ensureSession(); }
    if (tab === 'whiteboard') { ensureSession().then(() => loadWhiteboardSnapshot()); }
    if (tab === 'notes' || tab === 'scorecard') { loadInterviewRecord(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Notes / Transcript API
  const loadInterviewRecord = async () => {
    try {
      const res = await api.get(`/interview/${applicationId}`);
      const data = res.data || {};
      setNotes(Array.isArray(data.notes) ? data.notes : []);
      setTranscriptText(data.transcriptText || '');
      setSummaryText(data.summaryText || '');
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setScorecard(data.scorecard || null);
    } catch {}
  };
  const addNote = async () => {
    const text = (noteText || '').trim();
    if (!text) return;
    try {
      const res = await api.post(`/interview/${applicationId}/notes`, { text, tag: noteTag });
      setNotes(res.data?.notes || []);
      setNoteText('');
    } catch {}
  };
  const saveTranscript = async () => {
    try {
      setSavingTranscript(true);
      await api.post(`/interview/${applicationId}/transcript`, { transcriptText });
      showToast({ title: 'Transcript saved' });
    } catch (e) {
      showToast({ title: 'Save failed', message: e?.response?.data?.error || 'Please try again.' });
    } finally { setSavingTranscript(false); }
  };
  const summarizeTranscript = async () => {
    try {
      setSummarizing(true);
      const res = await api.post(`/interview/${applicationId}/summarize`);
      setSummaryText(res.data?.summaryText || '');
      const provider = res.data?.provider || 'ai';
      showToast({ title: 'Summary ready', message: provider === 'openai' ? 'Powered by AI' : 'Fallback summary generated' });
    } catch (e) {
      showToast({ title: 'Summary failed', message: e?.response?.data?.error || 'Please try again.' });
    } finally { setSummarizing(false); }
  };

  // Utilities
  const copyToClipboard = async (label, text) => {
    try { await navigator.clipboard.writeText(text || ''); showToast({ title: `${label} copied` }); }
    catch { showToast({ title: 'Copy failed', message: 'Clipboard unavailable' }); }
  };
  const downloadText = (filename, text) => {
    const blob = new Blob([text || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const addTimestampedNote = async (tag = 'general') => {
    try {
      const ts = new Date();
      const pad = (n)=>String(n).padStart(2,'0');
      const stamp = `${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`;
      const res = await api.post(`/interview/${applicationId}/notes`, { text: `[${stamp}]`, tag });
      setNotes(res.data?.notes || []);
      showToast({ title: 'Timestamp added' });
    } catch {}
  };

  // --------- ICE Servers helper (client tries server first) ----------
  const getIceServers = async () => {
    // 1) Try secure server proxy first (uses server-side secret)
    try {
      const res = await api.get('/turn/credentials'); // baseURL probably already /api
      if (Array.isArray(res.data?.iceServers) && res.data.iceServers.length) {
        try { console.log('[ICE] Using server-proxied iceServers:', res.data.iceServers.map(x=>x.urls)); } catch {}
        setIceSource('server');
        return res.data.iceServers;
      }
    } catch (e) {
      try { console.warn('[ICE] Proxy /turn/credentials failed'); } catch {}
    }

    // 2) Optional Metered direct (only if explicitly enabled and key present)
    const ENABLE_METERED = String(CLIENT_ENV.VITE_ENABLE_METERED ?? 'false').toLowerCase() === 'true';
    const sub = CLIENT_ENV.VITE_METERED_SUBDOMAIN;
    const key = CLIENT_ENV.VITE_METERED_API_KEY;
    const hasKey = Boolean(key);

    if (ENABLE_METERED && sub && hasKey) {
      try {
        const url = `https://${sub}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`;
        const res = await fetch(url, { method: 'GET' });
        try { console.log('[ICE] Metered direct status:', res.status); } catch {}
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (Array.isArray(data.iceServers) && data.iceServers.length) {
            try { console.log('[ICE] Using Metered direct iceServers:', data.iceServers.map(x=>x.urls)); } catch {}
            setIceSource('metered');
            return data.iceServers;
          }
        } else if (res.status === 401) {
          showToast?.({ title: 'TURN auth failed', message: 'Metered 401 from frontend. Prefer server proxy.' });
        }
      } catch {}
    }

    // 3) Fallback ENV (STUN/TURN) or default STUN
    const STUN_URLS = (import.meta.env.VITE_STUN_URLS || '').split(',').map(s=>s.trim()).filter(Boolean);
    const TURN_URLS = (import.meta.env.VITE_TURN_URLS || import.meta.env.VITE_TURN_URL || '').split(',').map(s=>s.trim()).filter(Boolean);
    const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME;
    const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL;
    const iceFromEnv = [];
    if (STUN_URLS.length) STUN_URLS.forEach(u=> iceFromEnv.push({ urls: u }));
    else iceFromEnv.push({ urls: 'stun:stun.l.google.com:19302' });
    if (TURN_URLS.length && TURN_USERNAME && TURN_CREDENTIAL) {
      TURN_URLS.forEach(u=> iceFromEnv.push({ urls: u, username: TURN_USERNAME, credential: TURN_CREDENTIAL }));
    }
    try { console.log('[ICE] Using env ICE (STUN/TURN):', iceFromEnv.map(x=>x.urls)); } catch {}
    setIceSource('env');
    return iceFromEnv;
  };
  // -------------------------------------------------------------------

  // Join / signaling
  useEffect(() => {
    // Prepare join function for user gesture
    const join = async () => {
      setJoining(true);
      try {
        // If user re-joins, remove old listeners first
        try { joinCleanupRef.current?.(); } catch {}
        joinCleanupRef.current = null;

        const socket = getSocket();
        if (!socket) throw new Error('Socket not initialized');
        if (!socket.connected) {
          await new Promise((resolve, reject) => {
            const onConnect = () => { cleanup(); resolve(); };
            const onErr = (e) => { cleanup(); reject(e || new Error('connect_error')); };
            const timeout = setTimeout(() => { cleanup(); reject(new Error('socket connect timeout')); }, 7000);
            const cleanup = () => { try { clearTimeout(timeout); socket.off('connect', onConnect); socket.off('connect_error', onErr); } catch {} };
            try { socket.on('connect', onConnect); socket.on('connect_error', onErr); socket.connect(); } catch { cleanup(); resolve(); }
          });
        }

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const iceServers = await getIceServers();
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        // Add local tracks
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        // ICE
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit('call:ice', { applicationId, candidate: e.candidate });
          }
        };

        // Perfect negotiation
        pc.onnegotiationneeded = async () => {
          try {
            makingOfferRef.current = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('call:offer', { applicationId, description: pc.localDescription });
          } catch {} finally {
            makingOfferRef.current = false;
          }
        };

        pc.ontrack = (e) => {
          const [remote] = e.streams;
          if (remoteVideoRef.current && remote) remoteVideoRef.current.srcObject = remote;
        };

        const maybeNegotiate = async () => {
          const pc = pcRef.current;
          if (!pc) return;
          if (pc.signalingState !== 'stable') return;
          try {
            makingOfferRef.current = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('call:offer', { applicationId, description: pc.localDescription });
          } catch {} finally { makingOfferRef.current = false; }
        };

        const drainPendingIce = async () => {
          const pc = pcRef.current;
          const list = pendingIceRef.current;
          pendingIceRef.current = [];
          for (const cand of list) {
            try { await pc.addIceCandidate(cand); } catch {}
          }
        };

        // Socket handlers
        const onParticipants = ({ participants, role }) => {
          roleRef.current = role || roleRef.current;
          // Force polite mode to avoid offer glare when two tabs join with same role/user
          politeRef.current = true;
          // If at least two participants are present in the room, try to negotiate
          const count = (participants || []).length;
          setParticipantsCount(count || 1);
          if (count >= 2) {
            // In development, be aggressive: negotiate as soon as 2+ participants
            if (import.meta.env.DEV) { setIsLeader(true); maybeNegotiate(); return; }
            // In production, decide a stable offerer by smallest tuple (userId, sid)
            try {
              const me = String(user?._id || '');
              const sid = String(getSocket()?.id || '');
              const tuples = (participants || []).map(p=>[String(p.userId||''), String(p.sid||'')]);
              tuples.sort((a,b)=> a[0]===b[0] ? (a[1]<b[1]? -1 : a[1]>b[1]? 1 : 0) : (a[0]<b[0]? -1 : 1));
              const leader = tuples[0];
              const amLeader = Boolean(leader && me && sid && leader[0] === me && leader[1] === sid);
              setIsLeader(amLeader);
              if (amLeader) { maybeNegotiate(); }
            } catch { /* fallback noop */ }
          }
        };
        const onPeerJoined = () => { setParticipantsCount((c) => Math.max(2, c + 1)); };
        const onPeerLeft = () => { otherUserIdRef.current = null; setParticipantsCount((c) => Math.max(1, c - 1)); };

        const onOffer = async ({ from, description }) => {
          otherUserIdRef.current = from || null;
          const offerCollision = makingOfferRef.current || settingRemoteAnswerPendingRef.current;
          ignoreOfferRef.current = !politeRef.current && offerCollision;
          if (ignoreOfferRef.current) return;
          try {
            if (offerCollision) await Promise.resolve();
            await pc.setRemoteDescription(description);
            const answer = await pc.createAnswer();
            settingRemoteAnswerPendingRef.current = true;
            await pc.setLocalDescription(answer);
            socket.emit('call:answer', { applicationId, description: pc.localDescription });
            await drainPendingIce();
          } catch {} finally {
            settingRemoteAnswerPendingRef.current = false;
          }
        };

        const onAnswer = async ({ description }) => {
          const pc = pcRef.current;
          if (pc.signalingState !== 'have-local-offer') return;
          try {
            await pc.setRemoteDescription(description);
            await drainPendingIce();
          } catch {}
        };

        const onIce = async ({ candidate }) => {
          const pc = pcRef.current;
          try {
            if (!pc.remoteDescription) {
              pendingIceRef.current.push(candidate);
            } else {
              await pc.addIceCandidate(candidate);
            }
          } catch {}
        };

        const onCode = ({ content }) => { setCode(String(content ?? '')); };
        const onWbStroke = ({ stroke }) => { drawStroke(stroke); };
        const onWbClear = () => { clearCanvas(); };
        const onError = ({ error: err }) => setError(err || 'Call error');

        socket.on('call:participants', onParticipants);
        socket.on('call:peer-joined', onPeerJoined);
        socket.on('call:peer-left', onPeerLeft);
        socket.on('call:offer', onOffer);
        socket.on('call:answer', onAnswer);
        socket.on('call:ice', onIce);
        socket.on('call:error', onError);
        socket.on('code:update', onCode);
        socket.on('wb:stroke', onWbStroke);
        socket.on('wb:clear', onWbClear);

        const cleanup = () => {
          try {
            socket.off('call:participants', onParticipants);
            socket.off('call:peer-joined', onPeerJoined);
            socket.off('call:peer-left', onPeerLeft);
            socket.off('call:offer', onOffer);
            socket.off('call:answer', onAnswer);
            socket.off('call:ice', onIce);
            socket.off('call:error', onError);
            socket.off('code:update', onCode);
            socket.off('wb:stroke', onWbStroke);
            socket.off('wb:clear', onWbClear);
          } catch {}
        };

        joinCleanupRef.current = cleanup;

        socket.emit('call:join', { applicationId });
        setReady(true);
        try { socket.emit('call:ring-app', { applicationId }); } catch {}
      } catch (err) {
        setError(err?.message || 'Failed to access camera/mic');
      } finally {
        setJoining(false);
      }
    };

    window.__joinCall = join;
    joinRef.current = join;

    return () => { /* nothing; we clean up on leave/unmount */ };
  }, [applicationId, user?._id]);

  // Clean up on unmount
  useEffect(() => () => { try { joinCleanupRef.current?.(); } catch {} }, []);

  // Auto-join on load when possible (dev/prod)
  useEffect(() => {
    if (!ready && !joining && joinRef.current) {
      // small delay to allow socket connect
      const t = setTimeout(() => { try { joinRef.current?.(); } catch {} }, 50);
      return () => clearTimeout(t);
    }
  }, [applicationId, ready, joining]);

  const toggleMute = () => {
    const s = localStreamRef.current; if (!s) return;
    const next = !muted; setMuted(next);
    s.getAudioTracks().forEach((t) => (t.enabled = !next));
  };
  const toggleCamera = () => {
    const s = localStreamRef.current; if (!s) return;
    const next = !cameraOff; setCameraOff(next);
    s.getVideoTracks().forEach((t) => (t.enabled = !next));
  };
  const shareScreen = async () => {
    if (sharing) return;
    try {
      const pc = pcRef.current; if (!pc) return;
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screen; setSharing(true);
      const sender = pc.getSenders().find((x) => x.track && x.track.kind === 'video');
      if (sender && screen.getVideoTracks()[0]) await sender.replaceTrack(screen.getVideoTracks()[0]);
      screen.getVideoTracks()[0].addEventListener('ended', async () => {
        const cam = localStreamRef.current?.getVideoTracks()[0];
        if (sender && cam) await sender.replaceTrack(cam);
        setSharing(false);
      });
    } catch {}
  };
  const leave = () => {
    try { joinCleanupRef.current?.(); } catch {}
    joinCleanupRef.current = null;
    try { getSocket()?.emit('call:leave', { applicationId }); } catch {}
    try { pcRef.current?.close(); } catch {}
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    navigate('/chat');
  };

  return (
    <div className="w-full h-full flex flex-col p-2 sm:p-3 gap-3">
      <CallHeader
        applicationId={applicationId}
        socketId={socketId}
        isLeader={isLeader}
        iceSource={iceSource}
        apiUrl={CLIENT_ENV.VITE_API_URL}
        enableMetered={CLIENT_ENV.VITE_ENABLE_METERED}
        meteredSubdomain={CLIENT_ENV.VITE_METERED_SUBDOMAIN}
        error={error}
        ready={ready}
        joining={joining}
        onJoin={() => joinRef.current?.()}
        onLeave={leave}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onShareScreen={shareScreen}
        onAddTimestampedNote={() => addTimestampedNote()}
        muted={muted}
        cameraOff={cameraOff}
        participantsCount={participantsCount}
      />

      {tab === 'scorecard' && (
        <ScorecardPane
          applicationId={applicationId}
          questions={questions}
          setQuestions={setQuestions}
          scorecard={scorecard}
          setScorecard={setScorecard}
          summaryText={summaryText}
          setSummaryText={setSummaryText}
          savingQuestions={savingQuestions}
          setSavingQuestions={setSavingQuestions}
          summarizing={summarizing}
          setSummarizing={setSummarizing}
          scoring={scoring}
          setScoring={setScoring}
        />
      )}
      <TabBar tab={tab} setTab={setTab} applicationId={applicationId} googleUrl={googleUrl} outlookUrl={outlookUrl} />

      {tab === 'video' && (
        <VideoPane localVideoRef={localVideoRef} remoteVideoRef={remoteVideoRef} />
      )}

      {tab === 'code' && (
        <CodePane code={code} onChange={emitCode} sessionId={sessionId} ensureSession={ensureSession} />
      )}

      {tab === 'whiteboard' && (
        <WhiteboardPane
          canvasRef={canvasRef}
          onClearBoard={onClearBoard}
          onCanvasDown={onCanvasDown}
          onCanvasMove={onCanvasMove}
          onCanvasUp={onCanvasUp}
        />
      )}

      {tab === 'notes' && (
        <NotesPane
          applicationId={applicationId}
          notes={notes}
          noteText={noteText}
          setNoteText={setNoteText}
          noteTag={noteTag}
          setNoteTag={setNoteTag}
          noteFilter={noteFilter}
          setNoteFilter={setNoteFilter}
          addNote={addNote}
          copyToClipboard={copyToClipboard}
          downloadText={downloadText}
          recording={recording}
          startRecording={startRecording}
          stopRecording={stopRecording}
          onAudioFilePick={onAudioFilePick}
          uploadingAudio={uploadingAudio}
          transcriptText={transcriptText}
          setTranscriptText={setTranscriptText}
          saveTranscript={saveTranscript}
          savingTranscript={savingTranscript}
          summarizeTranscript={summarizeTranscript}
          summarizing={summarizing}
          transcriptSavedAt={transcriptSavedAt}
          summaryText={summaryText}
        />
      )}
    </div>
  );
}
