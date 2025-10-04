import { useEffect, useState } from 'react'; import { useAuth } from '../context/AuthContext'; import { api } from '../utils/api';
export default function CandidateDashboard(){ const {token}=useAuth(); const [apps,setApps]=useState([]); const [notes,setNotes]=useState([]);
  useEffect(()=>{ const url=(import.meta.env.VITE_API_URL||'http://localhost:5000')+'/api/applications/me'; fetch(url,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(setApps).catch(()=>{}); api.get('/notifications').then(r=>setNotes(r.data)).catch(()=>{}); },[token]);
  const unread=notes.filter(n=>!n.read).length; const markAll=async()=>{ await api.patch('/notifications/read-all'); const r=await api.get('/notifications'); setNotes(r.data); };
  return(<div className="space-y-6">
    <h1 className="text-xl font-semibold">My Applications</h1>
    <div className="grid gap-3">{apps.map(a=>(<div key={a._id} className="border rounded-xl bg-white p-4"><div className="font-semibold">{a.job?.title}</div><div className="text-sm text-gray-600">{a.job?.company} — {a.job?.location}</div><div className="text-sm">Status: <span className="font-medium">{a.status}</span></div></div>))}</div>
    <div className="bg-white border rounded-xl p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Notifications</h2><button onClick={markAll} className="text-sm underline">Mark all read</button></div>
      <div className="text-sm text-gray-500 mb-2">{unread} unread</div>
      <div className="grid gap-2">{notes.map(n=>(<div key={n._id} className={"p-2 rounded border "+(n.read?"bg-white":"bg-gray-100")}><div className="font-medium">{n.title}</div><div>{n.message}</div></div>))}</div>
    </div>
  </div>);
}
