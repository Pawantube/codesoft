import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { showToast } from '../utils/toast';

export default function Screening() {
  const { id: applicationId } = useParams();
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [questions, setQuestions] = useState([]);
  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/screening/${applicationId}`);
        const qs = res?.data?.questions;
        setQuestions(Array.isArray(qs) ? qs : []);
      } catch {}
    };
    load();
  }, [applicationId]);

  const start = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      if (videoRef.current) videoRef.current.srcObject = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8,opus' });
      recorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        await upload(blob);
      };
      mr.start(500);
      setRecording(true);
    } catch (e) {
      showToast({ title: 'Camera/Mic error', message: 'Please grant permissions and try again.' });
    }
  };

  const stop = () => {
    try { recorderRef.current?.stop(); } catch {}
    try { streamRef.current?.getTracks().forEach(t=>t.stop()); } catch {}
    setRecording(false);
  };

  const upload = async (blob) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('video', blob, 'screening.webm');
      await api.post(`/screening/${applicationId}/upload`, fd);
      showToast({ title: 'Uploaded', message: 'Your screening has been submitted.' });
    } catch (e) {
      showToast({ title: 'Upload failed', message: e?.response?.data?.error || 'Please try again.' });
    } finally { setUploading(false); }
  };

  return (
    <div className="mx-auto w-full max-w-3xl p-4 space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="text-lg font-semibold">Async Screening</div>
        <div className="text-sm text-gray-600">Record short answers to the prompts below, then submit.</div>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="font-medium text-sm">Prompts</div>
        <ol className="list-decimal pl-5 text-sm space-y-1">
          {questions.length === 0 && <li className="text-gray-500">No prompts provided. You may still record a short intro.</li>}
          {questions.map((q, i) => (<li key={i}>{q}</li>))}
        </ol>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          {!recording ? (
            <button onClick={start} className="rounded bg-purple-600 px-3 py-1 text-sm text-white">Start Recording</button>
          ) : (
            <button onClick={stop} className="rounded bg-red-600 px-3 py-1 text-sm text-white">Stop</button>
          )}
          {uploading && <span className="text-sm text-gray-600">Uploading…</span>}
        </div>
        <video ref={videoRef} autoPlay playsInline muted className="w-full rounded border bg-black" />
        {previewUrl && (
          <div>
            <div className="text-sm font-medium">Preview</div>
            <video controls src={previewUrl} className="w-full rounded border bg-black" />
          </div>
        )}
      </div>
    </div>
  );
}
