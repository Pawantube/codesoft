import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../utils/socket';
import { useAuth } from '../context/AuthContext';

export default function IncomingCallBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ring, setRing] = useState(null); // { applicationId, from }
  const ringAudioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onRing = ({ applicationId, from }) => {
      setRing({ applicationId, from });
      try { ringAudioRef.current?.play?.(); } catch {}
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setRing(null), 30000);
    };
    socket.on('call:ring', onRing);
    return () => {
      socket.off('call:ring', onRing);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user?._id]);

  if (!ring) return null;

  return (
    <>
      <div className="border-t bg-yellow-50">
        <div className="mx-auto flex items-center justify-between px-4 py-2 text-sm text-gray-800 lg:max-w-6xl">
          <div>Incoming call</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const id = ring.applicationId;
                setRing(null);
                try { ringAudioRef.current?.pause?.(); ringAudioRef.current.currentTime = 0; } catch {}
                if (timerRef.current) clearTimeout(timerRef.current);
                navigate(`/call/${id}`);
              }}
              className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white"
            >
              Accept
            </button>
            <button
              onClick={() => {
                setRing(null);
                try { ringAudioRef.current?.pause?.(); ringAudioRef.current.currentTime = 0; } catch {}
                if (timerRef.current) clearTimeout(timerRef.current);
              }}
              className="rounded border px-3 py-1 text-xs"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
      <audio ref={ringAudioRef} preload="auto">
        <source src="https://actions.google.com/sounds/v1/alarms/medium_bell_ringing_near.ogg" type="audio/ogg" />
        <source src="https://actions.google.com/sounds/v1/alarms/medium_bell_ringing_near.wav" type="audio/wav" />
      </audio>
    </>
  );
}
