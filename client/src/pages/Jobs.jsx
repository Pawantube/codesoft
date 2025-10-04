import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import JobCard from '../components/JobCard';
import SearchBar from '../components/SearchBar';
import { useSearchParams } from 'react-router-dom';
export default function Jobs(){
  const [params,setParams]=useSearchParams(); const [jobs,setJobs]=useState([]); const [total,setTotal]=useState(0);
  const page=Number(params.get('page')||1); const q=params.get('q')||''; const location=params.get('location')||'';
  const minExperience=params.get('minExperience')||''; const shift=params.get('shift')||''; const workType=params.get('workType')||'';
  const fetchJobs=async()=>{ const r=await api.get('/jobs',{params:{q,location,page,limit:9,minExperience,shift,workType}}); setJobs(r.data.items); setTotal(r.data.total); };
  useEffect(()=>{ fetchJobs().catch(()=>{}); },[q,location,page,minExperience,shift,workType]);
  return(<div className="space-y-4">
    <SearchBar initial={q} initialLocation={location} onSearch={(x)=>setParams({...Object.fromEntries(params),...x,page:1})}/>
    <div className="flex flex-wrap gap-2 items-end">
      <label className="text-sm">Experience (yrs ≤): <input className="border rounded px-2 py-1 ml-1 w-20" value={minExperience} onChange={e=>setParams({...Object.fromEntries(params),minExperience:e.target.value,page:1})} placeholder="2"/></label>
      <select className="border rounded px-2 py-1" value={shift} onChange={e=>setParams({...Object.fromEntries(params),shift:e.target.value,page:1})}>
        <option value="">Any shift</option><option>Day</option><option>Night</option><option>Rotational</option><option>Flexible</option>
      </select>
      <select className="border rounded px-2 py-1" value={workType} onChange={e=>setParams({...Object.fromEntries(params),workType:e.target.value,page:1})}>
        <option value="">Any work type</option><option>On-Site</option><option>Remote</option><option>Hybrid</option>
      </select>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{jobs.map(j=><JobCard key={j._id} job={j}/>)}</div>
    <div className="flex justify-center gap-2">
      <button disabled={page<=1} onClick={()=>setParams({...Object.fromEntries(params),page:page-1})} className="px-3 py-1 rounded border disabled:opacity-50">Prev</button>
      <button disabled={(page*9)>=total} onClick={()=>setParams({...Object.fromEntries(params),page:page+1})} className="px-3 py-1 rounded border disabled:opacity-50">Next</button>
    </div>
  </div>);
}
