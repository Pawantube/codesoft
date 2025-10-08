import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export default function EditJob() {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState(null);

  useEffect(() => {
    api.get(`/jobs/${id}`).then(res => {
      const j = res.data;
      setForm({
        title: j.title, company: j.company, location: j.location,
        type: j.type, workType: j.workType, shift: j.shift,
        minExperience: j.minExperience, description: j.description,
        salaryMin: j.salaryMin || '', salaryMax: j.salaryMax || '',
        featured: j.featured, faqs: j.faqs?.length ? j.faqs : [{ q:'', a:'' }]
      });
    });
  }, [id]);

  const setFAQ = (i,k,v) => {
    const f = [...form.faqs]; f[i] = { ...f[i], [k]: v }; setForm({ ...form, faqs: f });
  };
  const save = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      minExperience: Number(form.minExperience || 0),
      salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
      salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined
    };
    await api.patch(`/jobs/${id}`, payload);
    nav('/employer/jobs');
  };

  if (!form) return <div>Loading...</div>;

  return (
    <form onSubmit={save} className="max-w-2xl mx-auto bg-white p-6 rounded-xl border grid gap-3">
      <h1 className="text-xl font-semibold">Edit job</h1>

      <input className="border rounded px-3 py-2" value={form.title}
             onChange={e=>setForm({...form, title:e.target.value})}/>
      <input className="border rounded px-3 py-2" value={form.company}
             onChange={e=>setForm({...form, company:e.target.value})}/>
      <input className="border rounded px-3 py-2" value={form.location}
             onChange={e=>setForm({...form, location:e.target.value})}/>

      <div className="grid sm:grid-cols-2 gap-3">
        <select className="border rounded px-3 py-2" value={form.type}
                onChange={e=>setForm({...form, type:e.target.value})}>
          <option>Full-Time</option><option>Part-Time</option><option>Contract</option>
          <option>Internship</option><option>Remote</option><option>On-Site</option><option>Hybrid</option>
        </select>
        <select className="border rounded px-3 py-2" value={form.workType}
                onChange={e=>setForm({...form, workType:e.target.value})}>
          <option>On-Site</option><option>Remote</option><option>Hybrid</option>
        </select>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <select className="border rounded px-3 py-2" value={form.shift}
                onChange={e=>setForm({...form, shift:e.target.value})}>
          <option>Day</option><option>Night</option><option>Rotational</option><option>Flexible</option>
        </select>
        <input className="border rounded px-3 py-2" placeholder="Min experience (yrs)"
               value={form.minExperience} onChange={e=>setForm({...form, minExperience:e.target.value})}/>
      </div>

      <textarea className="border rounded px-3 py-2" rows="6"
                value={form.description} onChange={e=>setForm({...form, description:e.target.value})}/>

      <div className="grid grid-cols-2 gap-3">
        <input className="border rounded px-3 py-2" placeholder="Salary min (₹)"
               value={form.salaryMin} onChange={e=>setForm({...form, salaryMin:e.target.value})}/>
        <input className="border rounded px-3 py-2" placeholder="Salary max (₹)"
               value={form.salaryMax} onChange={e=>setForm({...form, salaryMax:e.target.value})}/>
      </div>

      <label className="flex gap-2 text-sm">
        <input type="checkbox" checked={!!form.featured}
               onChange={e=>setForm({...form, featured:e.target.checked})}/>
        Featured
      </label>

      <div className="space-y-2">
        <div className="font-semibold">Company FAQs</div>
        {form.faqs.map((f,i)=>(
          <div key={i} className="grid sm:grid-cols-2 gap-2">
            <input className="border rounded px-3 py-2" placeholder="Question" value={f.q||''}
                   onChange={e=>setFAQ(i,'q',e.target.value)}/>
            <input className="border rounded px-3 py-2" placeholder="Answer" value={f.a||''}
                   onChange={e=>setFAQ(i,'a',e.target.value)}/>
          </div>
        ))}
        <button type="button" className="text-sm underline"
                onClick={()=>setForm({...form, faqs:[...form.faqs, {q:'',a:''}]})}>Add FAQ</button>
      </div>

      <button className="px-4 py-2 rounded bg-gray-900 text-white">Save</button>
    </form>
  );
}
