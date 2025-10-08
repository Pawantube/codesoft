import { useState } from 'react'; import { api } from '../utils/api'; import { useNavigate } from 'react-router-dom';
export default function PostJob(){ const [form,setForm]=useState({title:'',company:'',location:'',type:'Full-Time',workType:'On-Site',shift:'Day',minExperience:0,description:'',salaryMin:'',salaryMax:'',featured:false,faqs:[{q:'',a:''}]}); const nav=useNavigate();
  const submit=async(e)=>{ e.preventDefault(); const payload={...form,minExperience:Number(form.minExperience||0),salaryMin:form.salaryMin?Number(form.salaryMin):undefined,salaryMax:form.salaryMax?Number(form.salaryMax):undefined}; try{ const r=await api.post('/jobs',payload); nav(`/jobs/${r.data._id}`);}catch{ alert('Failed to post job'); } };
  const setFAQ=(i,k,v)=>{ const f=[...form.faqs]; f[i]={...f[i],[k]:v}; setForm({...form,faqs:f}); };
  return(<form onSubmit={submit} className="max-w-2xl mx-auto bg-white p-6 rounded-xl border grid gap-3">
    <h1 className="text-xl font-semibold">Post a job</h1>
    <input className="border rounded-lg px-3 py-2" placeholder="Job title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/>
    <input className="border rounded-lg px-3 py-2" placeholder="Company" value={form.company} onChange={e=>setForm({...form,company:e.target.value})} required/>
    <input className="border rounded-lg px-3 py-2" placeholder="Location" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} required/>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <select className="border rounded-lg px-3 py-2" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option>Full-Time</option><option>Part-Time</option><option>Contract</option><option>Internship</option><option>Remote</option><option>On-Site</option><option>Hybrid</option></select>
      <select className="border rounded-lg px-3 py-2" value={form.workType} onChange={e=>setForm({...form,workType:e.target.value})}><option>On-Site</option><option>Remote</option><option>Hybrid</option></select>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <select className="border rounded-lg px-3 py-2" value={form.shift} onChange={e=>setForm({...form,shift:e.target.value})}><option>Day</option><option>Night</option><option>Rotational</option><option>Flexible</option></select>
      <input className="border rounded-lg px-3 py-2" placeholder="Min experience (yrs)" value={form.minExperience} onChange={e=>setForm({...form,minExperience:e.target.value})}/>
    </div>
    <textarea className="border rounded-lg px-3 py-2" rows="6" placeholder="Description (min 20 chars)" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required/>
    <div className="grid grid-cols-2 gap-3">
      <input className="border rounded-lg px-3 py-2" placeholder="Salary min (₹)" value={form.salaryMin} onChange={e=>setForm({...form,salaryMin:e.target.value})}/>
      <input className="border rounded-lg px-3 py-2" placeholder="Salary max (₹)" value={form.salaryMax} onChange={e=>setForm({...form,salaryMax:e.target.value})}/>
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/> Featured</label>
    <div className="space-y-2"><div className="font-semibold">Company FAQs (optional)</div>
      {form.faqs.map((f,i)=>(<div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input className="border rounded px-3 py-2" placeholder="Question" value={f.q} onChange={e=>setFAQ(i,'q',e.target.value)}/><input className="border rounded px-3 py-2" placeholder="Answer" value={f.a} onChange={e=>setFAQ(i,'a',e.target.value)}/></div>))}
      <button type="button" onClick={()=>setForm({...form,faqs:[...form.faqs,{q:'',a:''}]})} className="text-sm underline">Add FAQ</button>
    </div>
    <button className="px-4 py-2 rounded-lg bg-gray-900 text-white">Publish</button>
  </form>);
}
