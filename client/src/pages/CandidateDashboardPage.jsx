import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';

export default function CandidateDashboardPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get('/applications/me');
        setApps(Array.isArray(res.data) ? res.data : []);
      } catch {
        setApps([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const interviews = apps
    .filter((a) => a?.status && a?.job)
    .filter((a) => a?.interview && a.interview.status === 'scheduled');

  return (
    <div className="mx-auto max-w-4xl w-full space-y-6">
      <header className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold">My Dashboard</h1>
        <p className="text-sm text-gray-600">Track your applications and interviews.</p>
      </header>

      <section className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Upcoming Interviews</h2>
          <Link to="/chat" className="text-xs underline">Open Chat</Link>
        </div>
        {loading && <div className="text-sm text-gray-500 mt-2">Loading…</div>}
        {!loading && interviews.length === 0 && (
          <div className="text-sm text-gray-500 mt-2">No interviews scheduled yet. Watch this space after an employer invites you.</div>
        )}
        <div className="mt-3 grid gap-3">
          {interviews.map((a) => (
            <div key={a.id || a._id} className="rounded-lg border p-3">
              <div className="font-medium">{a.job?.title} - {a.job?.company}</div>
              <div className="text-sm text-gray-600">{a.job?.location}</div>
              <div className="mt-2 text-sm">
                <div><span className="font-medium">When:</span> {a.interview?.at ? new Date(a.interview.at).toLocaleString() : '—'}</div>
                {a.interview?.notes && (
                  <div><span className="font-medium">Notes:</span> {a.interview.notes}</div>
                )}
              </div>
              <div className="mt-2">
                <button onClick={() => navigate(`/call/${a.id || a._id}`)} className="rounded bg-purple-600 text-white px-3 py-1 text-sm">Join Video Call</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold">My Applications</h2>
        <div className="mt-2 grid gap-2">
          {apps.map((a) => (
            <div key={a.id || a._id} className="rounded border p-3 text-sm flex items-center justify-between">
              <div>
                <div className="font-medium">{a.job?.title} - {a.job?.company}</div>
                <div className="text-gray-600">Status: {a.status}</div>
              </div>
              <Link to={`/jobs/${a.job?.id || a.job?._id}`} className="underline">View</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
