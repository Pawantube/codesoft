import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket, initSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import Editor from '@monaco-editor/react';

// Minimal 1:1 WebRTC call page with screenshare, signaled via socket.io
export default function LiveCallPage() {
  const { id: applicationId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [ready, setReady] = useState(false); // joined and media ready
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [tab, setTab] = useState('video'); // 'video' | 'code' | 'whiteboard' | 'notes'
  const [code, setCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const audioMixContextRef = useRef(null);
  const audioDestRef = useRef(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const otherUserIdRef = useRef(null); // kept for compatibility but no longer required for signaling
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });

  useEffect(() => { if (token) initSocket(token); }, [token]);

  useEffect(() => {
    let isActive = true;
    let teardown = () => {};

    const setupLiveCall = async () => {
      const socket = getSocket();
      if (!socket) throw new Error('Socket not connected');

      const join = async () => {
        setJoining(true);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;

          const TURN_URL = import.meta.env.VITE_TURN_URL;
          const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME;
          const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL;
          const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
          if (TURN_URL && TURN_USERNAME && TURN_CREDENTIAL) {
            iceServers.push({ urls: TURN_URL, username: TURN_USERNAME, credential: TURN_CREDENTIAL });
          }
          const pc = new RTCPeerConnection({ iceServers });
          pcRef.current = pc;
          stream.getTracks().forEach((t) => pc.addTrack(t, stream));

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              socket.emit('call:ice', { applicationId, candidate: e.candidate });
            }
          };

  // --- Recording helpers ---
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
      // remote audio from remote video element
      const remoteStream = remoteVideoRef.current?.srcObject;
      if (remoteStream) addSrc(remoteStream);

      return dest.stream;
    } catch {
      return null;
    }
  };

  const startRecording = async () => {
    if (recording) return;
    const mixed = buildMixedAudioStream();
    if (!mixed) { alert('AudioContext not available'); return; }
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
    } catch (e) {
      alert('Recording failed');
    }
  };
  const stopRecording = () => {
    try { mediaRecorderRef.current?.stop(); } catch {}
    setRecording(false);
    try { audioMixContextRef.current?.close(); } catch {}
    audioMixContextRef.current = null; audioDestRef.current = null;
  };

  const uploadAudioBlob = async (blob, filename='audio.webm') => {
    try {
      setUploadingAudio(true);
      const fd = new FormData();
      fd.append('audio', blob, filename);
      const res = await api.post(`/interview/${applicationId}/transcribe`, fd);
      if (res?.data?.transcriptText) setTranscriptText(res.data.transcriptText);
    } catch (e) {
      alert(e?.response?.data?.error || 'Transcription failed');
    } finally {
      setUploadingAudio(false);
    }
  };

  const onAudioFilePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await uploadAudioBlob(file, file.name || 'audio.webm');
  };
          pc.ontrack = (e) => {
            const [remote] = e.streams;
            if (remoteVideoRef.current && remote) remoteVideoRef.current.srcObject = remote;
          };

          const makeOffer = async () => {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('call:offer', { applicationId, description: offer });
          };

          const onParticipants = ({ participants }) => {
            // If there is another participant present, create an offer
            const me = user?._id;
            const others = participants.filter((p) => String(p.userId) !== String(me));
            if (others.length) makeOffer();
          };
          const onPeerJoined = () => { makeOffer(); };
          const onPeerLeft = () => { otherUserIdRef.current = null; };
          const onOffer = async ({ from, description }) => {
            otherUserIdRef.current = from || null;
            await pc.setRemoteDescription(description);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('call:answer', { applicationId, description: answer });
          };
          const onAnswer = async ({ description }) => { await pc.setRemoteDescription(description); };
          const onIce = async ({ candidate }) => { try { await pc.addIceCandidate(candidate); } catch {} };
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
          };

          socket.emit('call:join', { applicationId });
          setReady(true);

          // return cleanup function for listeners
          return cleanup;
        } catch (err) {
          setError(err?.message || 'Failed to access camera/mic');
        } finally {
          setJoining(false);
        }
      };

      // expose join for button handler
      window.__joinCall = join;
      // nothing to cleanup yet until user joins; return a no-op
      return () => {};
    };

    const maybeSetTeardown = (res) => {
      if (!isActive) return;
      if (typeof res === 'function') teardown = res;
      else if (res && typeof res.cleanup === 'function') teardown = res.cleanup;
    };

    try {
      const result = setupLiveCall?.();
      if (result && typeof result.then === 'function') {
        result.then(maybeSetTeardown).catch(() => {});
      } else {
        maybeSetTeardown(result);
      }
    } catch (e) {
      setError(e?.message || 'Failed to start call');
    }

    return () => {
      isActive = false;
      try { teardown(); } catch {}
    };
  }, [applicationId, user?._id]);

  // --- Code editor emit ---
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
    // Whiteboard snapshot will be loaded upon switching to tab
    return String(s._id || '');
  };

  // Debounce-persist code to server when on Code tab
  const codeSaveTimer = useRef(null);
  useEffect(() => {
    if (tab !== 'code' || !sessionId) return;
    if (codeSaveTimer.current) clearTimeout(codeSaveTimer.current);
    codeSaveTimer.current = setTimeout(async () => {
      try { await api.patch(`/coding-sessions/${sessionId}/code`, { code }); } catch {}
    }, 800);
    return () => { if (codeSaveTimer.current) clearTimeout(codeSaveTimer.current); };
  }, [code, tab, sessionId]);

  // --- Whiteboard helpers ---
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
        img.onload = () => { const ctx = getCtx(); if (!ctx) return; ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height); };
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
  const onClearBoard = () => { clearCanvas(); try { getSocket()?.emit('wb:clear', { applicationId }); } catch {} scheduleSaveWhiteboard(true); };
  const wbSaveTimer = useRef(null);
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
    if (tab === 'notes') { loadInterviewRecord(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // --- Notes / Transcript API ---
  const loadInterviewRecord = async () => {
    try {
      const res = await api.get(`/interview/${applicationId}`);
      const data = res.data || {};
      setNotes(Array.isArray(data.notes) ? data.notes : []);
      setTranscriptText(data.transcriptText || '');
      setSummaryText(data.summaryText || '');
    } catch {}
  };
  const addNote = async () => {
    const text = (noteText || '').trim();
    if (!text) return;
    try {
      const res = await api.post(`/interview/${applicationId}/notes`, { text });
      setNotes(res.data?.notes || []);
      setNoteText('');
    } catch {}
  };
  const saveTranscript = async () => {
    try {
      setSavingTranscript(true);
      await api.post(`/interview/${applicationId}/transcript`, { transcriptText });
    } catch {} finally { setSavingTranscript(false); }
  };
  const summarizeTranscript = async () => {
    try {
      setSummarizing(true);
      const res = await api.post(`/interview/${applicationId}/summarize`);
      setSummaryText(res.data?.summaryText || '');
    } catch (e) {
      // show minimal fallback
    } finally { setSummarizing(false); }
  };

  const toggleMute = () => {
    const s = localStreamRef.current; if (!s) return; const next = !muted; setMuted(next); s.getAudioTracks().forEach((t) => (t.enabled = !next));
  };
  const toggleCamera = () => {
    const s = localStreamRef.current; if (!s) return; const next = !cameraOff; setCameraOff(next); s.getVideoTracks().forEach((t) => (t.enabled = !next));
  };
  const shareScreen = async () => {
    if (sharing) return;
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screen; setSharing(true);
      const sender = pcRef.current.getSenders().find((x) => x.track && x.track.kind === 'video');
      if (sender && screen.getVideoTracks()[0]) await sender.replaceTrack(screen.getVideoTracks()[0]);
      screen.getVideoTracks()[0].addEventListener('ended', async () => {
        const cam = localStreamRef.current?.getVideoTracks()[0];
        if (sender && cam) await sender.replaceTrack(cam);
        setSharing(false);
      });
    } catch {}
  };
  const leave = () => {
    try { getSocket()?.emit('call:leave', { applicationId }); } catch {}
    try { pcRef.current?.close(); } catch {}
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    navigate('/chat');
  };

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-3">
      <div className="rounded-xl border bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <div className="font-semibold">Live Call</div>
            <div className="text-gray-500">Application ID: {applicationId}</div>
            {error && <div className="text-red-600">{error}</div>}
          </div>
          <div className="flex items-center gap-2">
            {!ready ? (
              <button onClick={() => window.__joinCall?.()} disabled={joining} className="rounded bg-purple-600 px-3 py-1 text-sm text-white disabled:opacity-50">
                {joining ? 'Joining…' : 'Join Call'}
              </button>
            ) : (
              <>
                <button onClick={toggleMute} className="rounded border px-3 py-1 text-sm">{muted ? 'Unmute' : 'Mute'}</button>
                <button onClick={toggleCamera} className="rounded border px-3 py-1 text-sm">{cameraOff ? 'Camera On' : 'Camera Off'}</button>
                <button onClick={shareScreen} className="rounded border px-3 py-1 text-sm">Share screen</button>
                <button onClick={leave} className="rounded bg-red-600 px-3 py-1 text-sm text-white">Leave</button>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <button className={`px-3 py-1 rounded ${tab==='video'?'bg-gray-900 text-white':'border'}`} onClick={()=>setTab('video')}>Video</button>
          <button className={`px-3 py-1 rounded ${tab==='code'?'bg-gray-900 text-white':'border'}`} onClick={()=>setTab('code')}>Code</button>
          <button className={`px-3 py-1 rounded ${tab==='whiteboard'?'bg-gray-900 text-white':'border'}`} onClick={()=>setTab('whiteboard')}>Whiteboard</button>
          <button className={`px-3 py-1 rounded ${tab==='notes'?'bg-gray-900 text-white':'border'}`} onClick={()=>setTab('notes')}>Notes</button>
        </div>
      </div>

      {tab === 'video' && (
        <div className="grid gap-3 md:grid-cols-2">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full rounded-lg border bg-black" />
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-lg border bg-black" />
        </div>
      )}

      {tab === 'code' && (
        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-600">Shared editor (synced + persisted)</div>
            {!sessionId && <button onClick={ensureSession} className="text-xs underline">Init session</button>}
          </div>
          <div className="min-h-[360px]">
            <Editor
              height="420px"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={code}
              onChange={(v)=>emitCode(v ?? '')}
              options={{ fontSize: 13, minimap: { enabled: false } }}
            />
          </div>
        </div>
      )}

      {tab === 'whiteboard' && (
        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-600">Collaborative whiteboard (synced + persisted)</div>
            <button className="px-2 py-1 border rounded text-sm" onClick={onClearBoard}>Clear</button>
          </div>
          <div className="w-full">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              onMouseDown={onCanvasDown}
              onMouseMove={onCanvasMove}
              onMouseUp={onCanvasUp}
              onMouseLeave={onCanvasUp}
              className="w-full rounded border bg-white"
            />
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="rounded-xl border bg-white p-3 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="font-semibold text-sm mb-1">Notes</div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Write a quick note" value={noteText} onChange={(e)=>setNoteText(e.target.value)} />
                  <button onClick={addNote} className="px-3 py-1 rounded bg-gray-900 text-white text-sm">Add</button>
                </div>
                <div className="border rounded p-2 max-h-72 overflow-auto text-sm">
                  {notes.length === 0 && <div className="text-gray-500">No notes yet.</div>}
                  {notes.map((n, idx) => (
                    <div key={idx} className="border-b py-1 last:border-b-0">
                      <div>{n.text}</div>
                      <div className="text-[11px] text-gray-500">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {!recording ? (
                    <button onClick={startRecording} className="px-3 py-1 rounded border">Record</button>
                  ) : (
                    <button onClick={stopRecording} className="px-3 py-1 rounded bg-red-600 text-white">Stop</button>
                  )}
                  <label className="px-2 py-1 border rounded cursor-pointer">
                    Upload audio
                    <input type="file" accept="audio/*,video/webm" className="hidden" onChange={onAudioFilePick} />
                  </label>
                  {uploadingAudio && <span>Uploading…</span>}
                </div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-sm mb-1">Transcript</div>
              <textarea className="w-full min-h-[160px] border rounded p-2 text-sm" value={transcriptText} onChange={(e)=>setTranscriptText(e.target.value)} placeholder="Paste the transcript here (or use your call recorder and paste results)…" />
              <div className="mt-2 flex gap-2">
                <button disabled={savingTranscript} onClick={saveTranscript} className="px-3 py-1 rounded border text-sm disabled:opacity-50">{savingTranscript? 'Saving…':'Save Transcript'}</button>
                <button disabled={summarizing} onClick={summarizeTranscript} className="px-3 py-1 rounded bg-purple-600 text-white text-sm disabled:opacity-50">{summarizing? 'Summarizing…':'Summarize'}</button>
              </div>
              <div className="mt-3">
                <div className="font-semibold text-sm mb-1">AI Summary</div>
                <div className="text-sm whitespace-pre-wrap border rounded p-2 min-h-[80px]">{summaryText || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
