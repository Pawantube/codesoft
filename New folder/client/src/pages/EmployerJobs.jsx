 import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';

export default function EmployerJobs() {
  const [items, setItems] = useState([]);

  const load = async () => {
    const res = await api.get('/jobs/mine/list');
    setItems(res.data.items || []);
  };
  useEffect(() => { load().catch(()=>{}); }, []);

  const del = async (id) => {
    if (!confirm('Delete this job?')) return;
    await api.delete(`/jobs/${id}`);
    await load();
  };
  const duplicate = async (id) => {
    await api.post(`/jobs/${id}/duplicate`);
    await load();
  };
  const toggleFeatured = async (id) => {
    await api.patch(`/jobs/${id}/feature`);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Job Posts</h1>
        <Link className="px-3 py-2 rounded bg-gray-900 text-white" to="/employer/post">New Job</Link>
      </div>

      <div className="grid gap-3">
        {items.map(j => (
          <div key={j._id} className="border rounded-xl bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{j.title}</div>
                <div className="text-sm text-gray-600">{j.company} — {j.location}</div>
                <div className="text-xs text-gray-500">Featured: {j.featured ? 'Yes' : 'No'}</div>
              </div>
              <div className="flex gap-2">
                <Link to={`/jobs/${j._id}`} className="px-3 py-1 rounded border">View</Link>
                <Link to={`/employer/edit/${j._id}`} className="px-3 py-1 rounded border">Edit</Link>
                <button onClick={() => duplicate(j._id)} className="px-3 py-1 rounded border">Duplicate</button>
                <button onClick={() => toggleFeatured(j._id)} className="px-3 py-1 rounded border">
                  {j.featured ? 'Unfeature' : 'Feature'}
                </button>
                <button onClick={() => del(j._id)} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
