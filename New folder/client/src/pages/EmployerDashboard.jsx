import { useEffect, useState } from 'react'; import { Link } from 'react-router-dom'; import { api } from '../utils/api';
export default function EmployerDashboard(){ const [jobs,setJobs]=useState([]);
  const fetchJobs=async()=>{ const r=await api.get('/jobs',{params:{limit:100}}); setJobs(r.data.items); };
  useEffect(()=>{ fetchJobs().catch(()=>{}); },[]);
  return(<div className="space-y-4">
    <div className="flex justify-between items-center"><h1 className="text-xl font-semibold">Employer Dashboard</h1><Link to="/employer/post" className="px-3 py-2 rounded-lg bg-gray-900 text-white">Post a job</Link></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {jobs.map(j=>(<div key={j._id} className="border rounded-xl bg-white p-4 space-y-2">
        <div className="font-semibold">{j.title}</div><div className="text-sm text-gray-600">{j.company} — {j.location}</div>
        <div className="text-xs text-gray-600">Exp: {j.minExperience||0}+ • Shift: {j.shift} • {j.workType}</div>
        <Link to={`/employer/manage/${j._id}`} className="text-sm px-3 py-1 rounded-lg bg-gray-900 text-white inline-block">Manage</Link>
		<Link to="/employer/jobs" className="text-sm underline">My Job Posts</Link>

      </div>))}
    </div>
  </div>);
}
