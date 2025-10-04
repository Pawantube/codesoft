import { useEffect, useState } from 'react'; import { useParams } from 'react-router-dom'; import { api } from '../utils/api';
export default function EmployerManageJob(){ const {id}=useParams(); const [apps,setApps]=useState([]);
  const load=async()=>{ const r=await api.get('/applications/employer',{params:{jobId:id}}); setApps(r.data); };
  useEffect(()=>{ load().catch(()=>{}); },[id]);
  const download=async(appid)=>{ const url=(import.meta.env.VITE_API_URL||'http://localhost:5000')+`/api/applications/${appid}/resume`; const resp=await fetch(url,{headers:{Authorization: api.defaults.headers.common['Authorization']}}); if(!resp.ok){alert('Download failed');return;} const blob=await resp.blob(); const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download='resume.pdf'; link.click(); await load(); };
  const setStatus=async(appid,status)=>{ await api.patch(`/applications/${appid}/status`,{status}); await load(); };
  return(<div className="space-y-4">
    <h1 className="text-xl font-semibold">Applicants</h1>
    <div className="grid gap-3">{apps.map(a=>(<div key={a._id} className="border rounded-xl bg-white p-4 flex flex-col gap-1">
      <div className="font-semibold">{a.candidate?.name || a.name} — <span className="text-xs">{a.email}</span></div>
      <div className="text-sm">Status: <span className="font-medium">{a.status}</span></div>
      <div className="flex gap-2 mt-2">
        <button onClick={()=>download(a._id)} className="px-3 py-1 rounded border">Download Resume</button>
        <button onClick={()=>setStatus(a._id,'accepted')} className="px-3 py-1 rounded bg-green-600 text-white">Accept</button>
        <button onClick={()=>setStatus(a._id,'rejected')} className="px-3 py-1 rounded bg-red-600 text-white">Reject</button>
      </div>
    </div>))}</div>
    <div className="mt-6">
      <h2 className="font-semibold">Hired</h2>
      <ul className="list-disc pl-6 text-sm">{apps.filter(a=>a.status==='accepted').map(a=>(<li key={a._id}>{a.candidate?.name || a.name} — {a.email}</li>))}</ul>
    </div>
    <div className="mt-6 bg-white border rounded-xl p-4">
      <h2 className="font-semibold">Job Management (placeholder)</h2>
      <p className="text-sm text-gray-600">Create projects, assign tasks, set deadlines, and track progress. (UI only — wire up later)</p>
      <div className="grid sm:grid-cols-2 gap-2 mt-2">
        <input className="border rounded px-2 py-1" placeholder="Project name"/>
        <input className="border rounded px-2 py-1" placeholder="Deadline (YYYY-MM-DD)"/>
        <input className="border rounded px-2 py-1" placeholder="Task title"/>
        <select className="border rounded px-2 py-1"><option>Todo</option><option>In Progress</option><option>Done</option></select>
        <button className="px-3 py-1 rounded bg-gray-900 text-white">Add</button>
      </div>
    </div>
  </div>);
}
