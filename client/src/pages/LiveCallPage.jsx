import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSocket, initSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';

// Minimal 1:1 WebRTC call page with screenshare, signaled via socket.io
export default function LiveCallPage() {
  const { id: applicationId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const otherUserIdRef = useRef(null);

  useEffect(() => { if (token) initSocket(token); }, [token]);

  useEffect(() => {
    const start = async () => {
      try {
        const socket = getSocket();
        if (!socket) throw new Error('Socket not connected');

        // Get media
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // Peer connection
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.onicecandidate = (e) => {
          if (e.candidate && otherUserIdRef.current) {
            socket.emit('call:ice', {
              applicationId,
              targetUserId: otherUserIdRef.current,
              candidate: e.candidate,
            });
          }
        };

        pc.ontrack = (e) => {
          const [remote] = e.streams;
          if (remoteVideoRef.current && remote) remoteVideoRef.current.srcObject = remote;
        };

        const makeOffer = async () => {
          if (!otherUserIdRef.current) return;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('call:offer', { applicationId, targetUserId: otherUserIdRef.current, description: offer });
        };

        const onParticipants = ({ participants }) => {
          const me = socket.user?.id;
          const other = participants.find((p) => p.userId !== me);
          otherUserIdRef.current = other?.userId || null;
          // If other already in room, initiate offer
          if (otherUserIdRef.current) makeOffer();
        };
        const onPeerJoined = ({ userId }) => { otherUserIdRef.current = userId; makeOffer(); };
        const onPeerLeft = () => { otherUserIdRef.current = null; };
        const onOffer = async ({ from, description }) => {
          otherUserIdRef.current = from;
          await pc.setRemoteDescription(description);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:answer', { applicationId, targetUserId: from, description: answer });
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

        socket.emit('call:join', { applicationId });

        return () => {
          socket.off('call:participants', onParticipants);
          socket.off('call:peer-joined', onPeerJoined);
          socket.off('call:peer-left', onPeerLeft);
          socket.off('call:offer', onOffer);
          socket.off('call:answer', onAnswer);
          socket.off('call:ice', onIce);
          socket.off('call:error', onError);
        };
      } catch (e) {
        setError(e.message || 'Failed to start call');
      }
    };
    const cleanup = start();
    return () => { cleanup?.(); };
  }, [applicationId]);

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
          <button onClick={toggleMute} className="rounded border px-3 py-1 text-sm">{muted ? 'Unmute' : 'Mute'}</button>
          <button onClick={toggleCamera} className="rounded border px-3 py-1 text-sm">{cameraOff ? 'Camera On' : 'Camera Off'}</button>
          <button onClick={shareScreen} className="rounded border px-3 py-1 text-sm">Share screen</button>
          <button onClick={leave} className="rounded bg-red-600 px-3 py-1 text-sm text-white">Leave</button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full rounded-lg border bg-black" />
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-lg border bg-black" />
      </div>
    </div>
  );
}
