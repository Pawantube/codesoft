import { useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { fileUrl } from '../utils/fileUrl';

const FALLBACK_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 64 64">
      <rect width="64" height="64" fill="#e5e7eb"/>
      <circle cx="32" cy="24" r="12" fill="#9ca3af"/>
      <rect x="12" y="42" width="40" height="14" rx="7" fill="#9ca3af"/>
    </svg>`
  );

export default function AvatarUploader() {
  const { user, setUser } = useAuth?.() || {};
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);

  const onChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.post('/media/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data?.user && setUser) setUser(res.data.user);
      setImgError(false);
    } catch (err) {
      setError(err?.response?.data?.error || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <img
          src={(user?.avatarUrl && !imgError ? (/^https?:\/\//i.test(user.avatarUrl) ? user.avatarUrl : fileUrl(user.avatarUrl)) : FALLBACK_AVATAR)}
          onError={(e) => { if (!imgError) { setImgError(true); e.currentTarget.src = FALLBACK_AVATAR; } }}
          alt="avatar"
          className="h-14 w-14 rounded-full object-cover border"
        />
        <label className="text-sm">
          <span className="px-3 py-1 rounded border cursor-pointer">{busy ? 'Uploading…' : 'Change avatar'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={onChange} disabled={busy} />
        </label>
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
