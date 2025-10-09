import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import AvatarUploader from '../components/AvatarUploader';

const toListString = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '',
    companyName: '',
    headline: '',
    bio: '',
    phone: '',
    location: '',
    skills: '',
    interests: '',
    avatarUrl: '',
    resumeUrl: '',
    videoTags: '',
    videoDuration: '',
    videoStatus: '',
    videoUrl: '',
    links: { linkedin: '', github: '', website: '' },
  });
  const [videoFile, setVideoFile] = useState(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoJson, setAutoJson] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);

  useEffect(() => {
    api.get('/users/me').then((res) => {
      const data = res.data || {};
      setForm((prev) => ({
        ...prev,
        ...data,
        skills: toListString(data.skills),
        interests: toListString(data.interests),
        videoTags: toListString(data.videoTags),
        // duration no longer user-editable; keep if backend sends for display only
        videoDuration: data.videoDuration ?? '',
        videoStatus: data.videoStatus || 'draft',
        videoUrl: data.videoUrl || '',
        links: {
          linkedin: data.links?.linkedin || '',
          github: data.links?.github || '',
          website: data.links?.website || '',
        },
      }));
    });
  }, []);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const autofillFromResume = async () => {
    if (!resumeFile) { alert('Select a resume file'); return; }
    try {
      const fd = new FormData();
      fd.append('resume', resumeFile);
      const res = await api.post('/resume/parse', fd);
      setAutoJson(res.data || {});
    } catch (e) {
      alert(e?.response?.data?.error || 'Parse failed');
    }
  };
  const applyAutofill = () => {
    const j = autoJson || {};
    setForm((prev) => ({
      ...prev,
      name: j.name || prev.name,
      headline: j.headline || prev.headline,
      location: j.location || prev.location,
      skills: toListString(j.skills) || prev.skills,
      bio: j.summary || prev.bio,
    }));
    setAutoJson(null);
  };

  const handleLinkChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      links: { ...prev.links, [key]: value },
    }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.put('/users/me', {
        name: form.name,
        companyName: form.companyName,
        headline: form.headline,
        bio: form.bio,
        phone: form.phone,
        location: form.location,
        skills: form.skills,
        interests: form.interests,
        avatarUrl: form.avatarUrl,
        resumeUrl: form.resumeUrl,
        links: form.links,
        videoTags: form.videoTags,
      });
      alert('Profile updated');
    } catch (error) {
      console.error(error);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const uploadVideo = async () => {
    if (!videoFile) {
      alert('Select a video to upload first');
      return;
    }
    setUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      if (form.videoTags) formData.append('tags', form.videoTags);

      const res = await api.post('/users/me/video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const payload = res.data || {};
      setForm((prev) => ({
        ...prev,
        videoUrl: payload.videoUrl || prev.videoUrl,
        videoStatus: payload.videoStatus || prev.videoStatus,
        videoTags: toListString(payload.videoTags) || prev.videoTags,
        videoDuration: payload.videoDuration ?? prev.videoDuration,
      }));
      setVideoFile(null);
      alert('Video uploaded successfully');
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || 'Failed to upload video');
    } finally {
      setUploadingVideo(false);
    }
  };

  return (
    <form onSubmit={saveProfile} className="mx-auto grid max-w-3xl gap-4 rounded-xl border bg-white p-6">
      <h1 className="text-xl font-semibold">My Profile</h1>

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Profile Photo</h2>
        <div className="mt-2">
          <AvatarUploader />
        </div>

      {user?.role === 'candidate' && (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Autofill From Resume (AI)</h2>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="file" accept=".pdf,.doc,.docx,.rtf" onChange={(e)=>setResumeFile(e.target.files?.[0]||null)} />
            <button type="button" onClick={autofillFromResume} className="rounded border px-3 py-1 text-sm">Parse</button>
          </div>
          {autoJson && (
            <div className="mt-3 text-sm">
              <div className="font-medium">Preview</div>
              <pre className="mt-1 whitespace-pre-wrap border rounded p-2 max-h-64 overflow-auto">{JSON.stringify(autoJson, null, 2)}</pre>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={applyAutofill} className="rounded bg-green-600 text-white px-3 py-1 text-sm">Apply</button>
                <button type="button" onClick={()=>setAutoJson(null)} className="rounded border px-3 py-1 text-sm">Discard</button>
              </div>
            </div>
          )}
        </section>
      )}
      </section>

      <input
        className="rounded border px-3 py-2"
        placeholder="Full name"
        value={form.name}
        onChange={(e) => handleChange('name', e.target.value)}
      />

      {user?.role === 'employer' && (
        <input
          className="rounded border px-3 py-2"
          placeholder="Company name"
          value={form.companyName || ''}
          onChange={(e) => handleChange('companyName', e.target.value)}
        />
      )}

      <input
        className="rounded border px-3 py-2"
        placeholder="Headline (e.g., React Developer)"
        value={form.headline || ''}
        onChange={(e) => handleChange('headline', e.target.value)}
      />

      <textarea
        className="rounded border px-3 py-2"
        rows={4}
        placeholder="Short bio"
        value={form.bio || ''}
        onChange={(e) => handleChange('bio', e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="rounded border px-3 py-2"
          placeholder="Phone"
          value={form.phone || ''}
          onChange={(e) => handleChange('phone', e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="Location"
          value={form.location || ''}
          onChange={(e) => handleChange('location', e.target.value)}
        />
      </div>

      <input
        className="rounded border px-3 py-2"
        placeholder="Skills (comma separated)"
        value={form.skills}
        onChange={(e) => handleChange('skills', e.target.value)}
      />

      <input
        className="rounded border px-3 py-2"
        placeholder="Interests (tags you follow)"
        value={form.interests}
        onChange={(e) => handleChange('interests', e.target.value)}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="rounded border px-3 py-2"
          placeholder="Avatar URL"
          value={form.avatarUrl || ''}
          onChange={(e) => handleChange('avatarUrl', e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="Resume URL"
          value={form.resumeUrl || ''}
          onChange={(e) => handleChange('resumeUrl', e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className="rounded border px-3 py-2"
          placeholder="LinkedIn"
          value={form.links?.linkedin || ''}
          onChange={(e) => handleLinkChange('linkedin', e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="GitHub"
          value={form.links?.github || ''}
          onChange={(e) => handleLinkChange('github', e.target.value)}
        />
        <input
          className="rounded border px-3 py-2"
          placeholder="Website"
          value={form.links?.website || ''}
          onChange={(e) => handleLinkChange('website', e.target.value)}
        />
      </div>

      {user?.role === 'candidate' && (
        <section className="mt-4 rounded-xl border p-4">
          <h2 className="text-lg font-semibold">Video Introduction</h2>
          <p className="text-sm text-gray-600">
            Upload a short introduction video. Highlight your experience, skills, and what you are looking for next.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              className="rounded border px-3 py-2"
              placeholder="Video tags (comma separated)"
              value={form.videoTags}
              onChange={(e) => handleChange('videoTags', e.target.value)}
            />
          </div>
          <div className="mt-3 text-sm text-gray-600">
            Status: <span className="font-medium text-gray-900">{form.videoStatus || 'draft'}</span>
          </div>
          {form.videoUrl && (
            <video
              src={form.videoUrl}
              controls
              className="mt-3 w-full rounded-lg border"
            />
          )}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <button
              type="button"
              disabled={!videoFile || uploadingVideo}
              onClick={uploadVideo}
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              {uploadingVideo ? 'Uploading�' : 'Upload video'}
            </button>
          </div>
        </section>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-4 rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? 'Saving�' : 'Save changes'}
      </button>
    </form>
  );
}
