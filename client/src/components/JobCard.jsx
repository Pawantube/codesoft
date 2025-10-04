import { Link } from 'react-router-dom';
export default function JobCard({job}){
  return(<div className="rounded-xl border bg-white p-4 flex flex-col gap-2 hover:shadow-md transition">
    <div className="flex justify-between items-start"><h3 className="font-semibold text-lg">{job.title}</h3><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{job.type}</span></div>
    <div className="text-sm text-gray-600">{job.company} — {job.location}</div>
    <div className="text-xs text-gray-600">Exp: {job.minExperience||0}+ yrs • Shift: {job.shift} • {job.workType}</div>
    { (job.salaryMin||job.salaryMax) && <div className="text-sm">₹ {job.salaryMin||''}{job.salaryMin&&job.salaryMax?' - ':''}{job.salaryMax||''}</div>}
    <p className="text-sm text-gray-700 line-clamp-2">{job.description}</p>
    <div className="flex justify-end"><Link to={`/jobs/${job._id}`} className="text-sm px-3 py-1 rounded-lg bg-gray-900 text-white">View</Link></div>
  </div>);
}
