import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function FAQ({ faqs = [] }) {
  const items = Array.isArray(faqs)
    ? faqs.filter((x) => x && (x.q || x.question || x.title))
    : [];
  if (!items.length) return null;
  return (
    <div className="bg-white rounded-xl border p-4 space-y-2">
      <h3 className="font-semibold">Company FAQs</h3>
      {items.map((f, i) => {
        const q = f.q || f.question || f.title || 'FAQ';
        const a = f.a || f.answer || '';
        return (
          <details key={`${q}-${i}`} className="border rounded p-2">
            <summary className="font-medium">{q}</summary>
            <div className="text-sm mt-1">{a}</div>
          </details>
        );
      })}
    </div>
  );
}

export default function JobDetail(){
  const {id}=useParams(); const [job,setJob]=useState(null); const [form,setForm]=useState({name:'',email:'',coverLetter:''}); const [file,setFile]=useState(null); const {user,token}=useAuth();
  const [myStatus,setMyStatus]=useState('');
  useEffect(()=>{ api.get(`/jobs/${id}`).then(r=>setJob(r.data)); },[id]);
  useEffect(()=>{ if(user?.role==='candidate'){ const url=(import.meta.env.VITE_API_URL||'http://localhost:5000')+'/api/applications/me'; fetch(url,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(list=>{ const hit=list.find(a=>a.job?._id===id); if(hit) setMyStatus(hit.status); }).catch(()=>{});} },[user,id,token]);
  const share=async()=>{ const url=window.location.href; try{ if(navigator.share) await navigator.share({title:job.title,url}); else { await navigator.clipboard.writeText(url); alert('Link copied'); } }catch{} };
  const apply=async(e)=>{ e.preventDefault(); if(!user||user.role!=='candidate'){ alert('Login as candidate to apply'); return; } const fd=new FormData(); fd.append('jobId',id); Object.entries(form).forEach(([k,v])=>fd.append(k,v)); if(file) fd.append('resume',file);
    const res=await fetch((import.meta.env.VITE_API_URL||'http://localhost:5000')+'/api/applications',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd}); if(!res.ok){ const msg=await res.text(); alert(`Apply failed: ${res.status} ${msg}`); return;} alert('Applied!'); setMyStatus('submitted'); };
  if(!job) return <div>Loading...</div>;
  return(<div className="space-y-6">
    <div className="bg-white rounded-xl border p-4 space-y-2">
      <div className="flex justify-between"><h1 className="text-2xl font-bold">{job.title}</h1><button onClick={share} className="text-sm px-3 py-1 rounded-lg border">Share</button></div>
      <div className="text-gray-600">{job.company} — {job.location}</div>
      <div className="text-sm">{job.type} • {job.workType} • Shift: {job.shift} • Exp: {job.minExperience}+ yrs</div>
      {myStatus && <div className="text-sm mt-2">Your status: <span className="font-medium">{myStatus}</span></div>}
      <p className="whitespace-pre-wrap">{job.description}</p>
    </div>
    <FAQ faqs={job.faqs}/>
    {user?.role==='candidate' && (<form onSubmit={apply} className="bg-white rounded-xl border p-4 grid gap-3">
      <h2 className="font-semibold text-lg">Apply</h2>
      <input className="border rounded-lg px-3 py-2" placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
      <input className="border rounded-lg px-3 py-2" placeholder="Email" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/>
      <textarea className="border rounded-lg px-3 py-2" placeholder="Cover letter (optional)" rows="5" value={form.coverLetter} onChange={e=>setForm({...form,coverLetter:e.target.value})}/>
      <input type="file" accept=".pdf,.doc,.docx" onChange={e=>setFile(e.target.files[0])}/>
      <button className="px-4 py-2 rounded-lg bg-gray-900 text-white">Submit application</button>
    </form>)}
  </div>);
}
