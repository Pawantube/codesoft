import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: '', companyName: '',
    headline: '', bio: '', phone: '', location: '',
    skills: '', avatarUrl: '', resumeUrl: '',
    links: { linkedin: '', github: '', website: '' }
  });

  useEffect(() => {
    api.get('/users/me').then(res => {
      const u = res.data || {};
      setForm({
        ...form,
        ...u,
        skills: Array.isArray(u.skills) ? u.skills.join(', ') : (u.skills || '')
      });
    });
    // eslint-disable-next-line
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form, skills: form.skills };
    await api.put('/users/me', payload);
    alert('Profile updated');
  };

  return (
    <form onSubmit={save} className="max-w-2xl mx-auto bg-white p-6 rounded-xl border grid gap-3">
      <h1 className="text-xl font-semibold">My Profile</h1>

      <input className="border rounded px-3 py-2" placeholder="Full name"
             value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />

      {user?.role === 'employer' && (
        <input className="border rounded px-3 py-2" placeholder="Company name"
               value={form.companyName||''} onChange={e=>setForm({...form, companyName:e.target.value})}/>
      )}

      <input className="border rounded px-3 py-2" placeholder="Headline (e.g., React Developer)"
             value={form.headline||''} onChange={e=>setForm({...form, headline:e.target.value})}/>

      <textarea className="border rounded px-3 py-2" rows="4" placeholder="Short bio"
                value={form.bio||''} onChange={e=>setForm({...form, bio:e.target.value})}/>

      <div className="grid sm:grid-cols-2 gap-3">
        <input className="border rounded px-3 py-2" placeholder="Phone"
               value={form.phone||''} onChange={e=>setForm({...form, phone:e.target.value})}/>
        <input className="border rounded px-3 py-2" placeholder="Location"
               value={form.location||''} onChange={e=>setForm({...form, location:e.target.value})}/>
      </div>

      <input className="border rounded px-3 py-2" placeholder="Skills (comma separated)"
             value={form.skills} onChange={e=>setForm({...form, skills:e.target.value})}/>

      <div className="grid sm:grid-cols-2 gap-3">
        <input className="border rounded px-3 py-2" placeholder="Avatar URL"
               value={form.avatarUrl||''} onChange={e=>setForm({...form, avatarUrl:e.target.value})}/>
        <input className="border rounded px-3 py-2" placeholder="Resume URL"
               value={form.resumeUrl||''} onChange={e=>setForm({...form, resumeUrl:e.target.value})}/>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <input className="border rounded px-3 py-2" placeholder="LinkedIn"
               value={form.links?.linkedin||''} onChange={e=>setForm({...form, links:{...form.links, linkedin:e.target.value}})}/>
        <input className="border rounded px-3 py-2" placeholder="GitHub"
               value={form.links?.github||''} onChange={e=>setForm({...form, links:{...form.links, github:e.target.value}})}/>
        <input className="border rounded px-3 py-2" placeholder="Website"
               value={form.links?.website||''} onChange={e=>setForm({...form, links:{...form.links, website:e.target.value}})}/>
      </div>

      <button className="px-4 py-2 rounded bg-gray-900 text-white">Save changes</button>
    </form>
  );
}
