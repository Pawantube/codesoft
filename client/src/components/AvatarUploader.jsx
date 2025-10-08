import { useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

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
          src={!imgError && user?.avatarUrl ? user.avatarUrl : 'https://ui-avatars.com/api/?background=EEE&color=111&name=' + encodeURIComponent(user?.name||'User')}
          onError={() => setImgError(true)}
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
