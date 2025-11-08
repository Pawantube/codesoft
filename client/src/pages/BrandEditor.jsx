import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const slugify = (s='') => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

export default function BrandEditor(){
  const { user } = useAuth();
  const [form, setForm] = useState({
    companyName: '',
    brandAbout: '',
    brandPerks: '',
    brandLogoUrl: '',
    brandCoverUrl: '',
    brandSocials: { website: '', linkedin: '', twitter: '' },
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    const load = async () => {
      try {
        const res = await api.get('/brand/me');
        const b = res.data || {};
        setForm({
          companyName: b.companyName || user?.companyName || '',
          brandAbout: b.brandAbout || '',
          brandPerks: Array.isArray(b.brandPerks) ? b.brandPerks.join(', ') : (b.brandPerks || ''),
          brandLogoUrl: b.brandLogoUrl || '',
          brandCoverUrl: b.brandCoverUrl || '',
          brandSocials: {
            website: b.brandSocials?.website || '',
            linkedin: b.brandSocials?.linkedin || '',
            twitter: b.brandSocials?.twitter || '',
          }
        });
      } finally { setLoading(false); }
    };
    load();
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        companyName: form.companyName,
        brandAbout: form.brandAbout,
        brandPerks: form.brandPerks,
        brandLogoUrl: form.brandLogoUrl,
        brandCoverUrl: form.brandCoverUrl,
        brandSocials: form.brandSocials,
      };
      await api.put('/brand/me', payload);
      alert('Brand saved');
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const companySlug = useMemo(()=> slugify(form.companyName || ''), [form.companyName]);

  if (loading) return <div className="p-4">Loading…</div>;

  return (
    <form onSubmit={save} className="mx-auto grid max-w-3xl gap-4 rounded-xl border bg-white p-6">
      <h1 className="text-xl font-semibold">Brand Editor</h1>

      <input className="rounded border px-3 py-2" placeholder="Company Name" value={form.companyName}
             onChange={e=>setForm({...form, companyName: e.target.value})} />

      <div className="grid gap-3 sm:grid-cols-2">
        <input className="rounded border px-3 py-2" placeholder="Logo URL" value={form.brandLogoUrl}
               onChange={e=>setForm({...form, brandLogoUrl: e.target.value})} />
        <input className="rounded border px-3 py-2" placeholder="Cover URL" value={form.brandCoverUrl}
               onChange={e=>setForm({...form, brandCoverUrl: e.target.value})} />
      </div>

      <textarea className="rounded border px-3 py-2" rows={4} placeholder="About"
                value={form.brandAbout} onChange={e=>setForm({...form, brandAbout: e.target.value})} />

      <input className="rounded border px-3 py-2" placeholder="Perks (comma separated)"
             value={form.brandPerks} onChange={e=>setForm({...form, brandPerks: e.target.value})} />

      <div className="grid gap-3 sm:grid-cols-3">
        <input className="rounded border px-3 py-2" placeholder="Website" value={form.brandSocials.website}
               onChange={e=>setForm({...form, brandSocials:{...form.brandSocials, website:e.target.value}})} />
        <input className="rounded border px-3 py-2" placeholder="LinkedIn" value={form.brandSocials.linkedin}
               onChange={e=>setForm({...form, brandSocials:{...form.brandSocials, linkedin:e.target.value}})} />
        <input className="rounded border px-3 py-2" placeholder="Twitter / X" value={form.brandSocials.twitter}
               onChange={e=>setForm({...form, brandSocials:{...form.brandSocials, twitter:e.target.value}})} />
      </div>

      <div className="rounded-lg border p-3">
        <div className="text-sm font-semibold">Preview</div>
        <div className="mt-2 rounded border">
          {form.brandCoverUrl && <img src={form.brandCoverUrl} alt="cover" className="h-32 w-full object-cover" />}
          <div className="flex items-center gap-3 p-3">
            {form.brandLogoUrl && <img src={form.brandLogoUrl} alt="logo" className="h-12 w-12 rounded object-cover border" />}
            <div>
              <div className="font-semibold">{form.companyName || 'Company'}</div>
              <div className="text-xs text-gray-600">{form.brandSocials.website}</div>
            </div>
          </div>
          {form.brandAbout && <div className="px-3 pb-3 text-sm whitespace-pre-wrap">{form.brandAbout}</div>}
          {form.brandPerks && (
            <div className="px-3 pb-3 text-xs text-gray-700">Perks: {form.brandPerks}</div>
          )}
        </div>
        {companySlug && (
          <div className="mt-2 text-xs">
            Public page: <Link to={`/brand/${companySlug}`} className="underline">/brand/{companySlug}</Link>
          </div>
        )}
      </div>

      <button type="submit" disabled={saving} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
