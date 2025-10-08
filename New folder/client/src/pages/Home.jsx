import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import JobCard from '../components/JobCard';
import SearchBar from '../components/SearchBar';
import { useNavigate } from 'react-router-dom';
export default function Home(){
  const [jobs,setJobs]=useState([]); const nav=useNavigate();
  const onSearch=(q)=>nav({pathname:'/jobs',search:new URLSearchParams(q).toString()});
  useEffect(()=>{ api.get('/jobs',{params:{featured:true,limit:6}}).then(r=>setJobs(r.data.items)).catch(()=>{}); },[]);
  return(<div className="space-y-6">
    <section className="text-center py-8 sm:py-12">
      <h1 className="text-3xl sm:text-4xl font-bold">Find your next opportunity</h1>
      <p className="text-gray-600 mt-2">Search thousands of jobs and apply in minutes.</p>
      <div className="mt-4 max-w-3xl mx-auto"><SearchBar onSearch={onSearch}/></div>
    </section>
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Featured jobs</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{jobs.map(j=><JobCard key={j._id} job={j}/> )}</div>
    </section>
  </div>);
}
