import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../utils/api';

const norm = (s='') => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

export default function BrandPage() {
  const { companySlug } = useParams();
  const [jobs, setJobs] = useState([]);
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(false);

  const companyNameFromSlug = useMemo(() => companySlug?.replace(/-/g,' ') || 'Company', [companySlug]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [jobsRes, brandRes] = await Promise.all([
          api.get('/jobs'),
          api.get('/brand/by-company', { params: { name: companyNameFromSlug } }).catch(()=>({ data:null }))
        ]);
        setJobs(Array.isArray(jobsRes.data) ? jobsRes.data : []);
        setBrand(brandRes?.data || null);
      } catch {
        setJobs([]); setBrand(null);
      } finally { setLoading(false); }
    };
    load();
  }, [companyNameFromSlug]);

  const companyJobs = useMemo(() => jobs.filter(j => norm(j.company) === companySlug), [jobs, companySlug]);
  const companyName = brand?.companyName || companyJobs[0]?.company || companyNameFromSlug;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 space-y-6">
      <header className="rounded-2xl border bg-white overflow-hidden">
        {brand?.brandCoverUrl && (
          <img src={brand.brandCoverUrl} alt="cover" className="h-40 w-full object-cover" />
        )}
        <div className="p-6 flex items-center gap-4">
          {brand?.brandLogoUrl && (
            <img src={brand.brandLogoUrl} alt="logo" className="h-16 w-16 rounded object-cover border" />
          )}
          <div>
            <div className="text-3xl font-bold">{companyName}</div>
            {brand?.brandSocials?.website && (
              <a href={brand.brandSocials.website} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">{brand.brandSocials.website}</a>
            )}
          </div>
        </div>
      </header>

      {brand?.brandAbout && (
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="text-lg font-semibold">About</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{brand.brandAbout}</p>
          {Array.isArray(brand.brandPerks) && brand.brandPerks.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="font-medium">Perks</div>
              <ul className="mt-1 list-disc pl-6">
                {brand.brandPerks.map((p,i)=>(<li key={i}>{p}</li>))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Open Roles</h2>
        {loading && <div className="mt-2 text-sm text-gray-600">Loading…</div>}
        {!loading && companyJobs.length === 0 && (
          <div className="mt-2 text-sm text-gray-600">No roles found for this company.</div>
        )}
        <div className="mt-3 grid gap-3">
          {companyJobs.map((j) => (
            <Link key={j._id || j.id} to={`/jobs/${j._id || j.id}`} className="rounded-lg border p-3 hover:bg-gray-50">
              <div className="font-medium">{j.title}</div>
              <div className="text-xs text-gray-600">{j.location} • {j.type} • {j.workType}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
