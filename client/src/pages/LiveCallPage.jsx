import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket, initSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';

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

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const otherUserIdRef = useRef(null); // kept for compatibility but no longer required for signaling

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

          const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
          pcRef.current = pc;
          stream.getTracks().forEach((t) => pc.addTrack(t, stream));

          pc.onicecandidate = (e) => {
            if (e.candidate) {
              socket.emit('call:ice', { applicationId, candidate: e.candidate });
            }
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
          const onError = ({ error: err }) => setError(err || 'Call error');

          socket.on('call:participants', onParticipants);
          socket.on('call:peer-joined', onPeerJoined);
          socket.on('call:peer-left', onPeerLeft);
          socket.on('call:offer', onOffer);
          socket.on('call:answer', onAnswer);
          socket.on('call:ice', onIce);
          socket.on('call:error', onError);

          const cleanup = () => {
            socket.off('call:participants', onParticipants);
            socket.off('call:peer-joined', onPeerJoined);
            socket.off('call:peer-left', onPeerLeft);
            socket.off('call:offer', onOffer);
            socket.off('call:answer', onAnswer);
            socket.off('call:ice', onIce);
            socket.off('call:error', onError);
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
      <div className="rounded-xl border bg-white p-3 flex items-center justify-between">
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
      <div className="grid gap-3 md:grid-cols-2">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full rounded-lg border bg-black" />
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-lg border bg-black" />
      </div>
    </div>
  );
}
