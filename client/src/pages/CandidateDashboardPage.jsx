import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';

export default function CandidateDashboardPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitForms, setSubmitForms] = useState({}); // appId:taskId -> { text, links }
  const [uploading, setUploading] = useState({}); // key -> boolean
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

  const uploadTaskFiles = async (appId, taskId, fileList) => {
    const key = `${appId}:${taskId}`;
    if (!fileList || fileList.length === 0) return;
    setUploading((p) => ({ ...p, [key]: true }));
    try {
      const urls = [];
      for (let i = 0; i < fileList.length; i++) {
        const fd = new FormData();
        fd.append('file', fileList[i]);
        const res = await api.post('/media/task-attachment', fd);
        if (res?.data?.url) urls.push(res.data.url);
      }
      setSubmitForms((p) => {
        const next = { ...(p[key] || {}) };
        const prior = (next.links || '').trim();
        const joined = prior ? prior + '\n' + urls.join('\n') : urls.join('\n');
        return { ...p, [key]: { ...next, links: joined } };
      });
    } catch (e) {
      alert(e?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading((p) => ({ ...p, [key]: false }));
    }
  };
    load();
  }, []);

  const interviews = apps
    .filter((a) => a?.status && a?.job)
    .filter((a) => a?.interview && a.interview.status === 'scheduled');

  const [recommended, setRecommended] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/recommendations/jobs');
        setRecommended(Array.isArray(res.data) ? res.data : []);
      } catch {}
    };
    load();
  }, []);

  const fmtGoogleDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n)=>String(n).padStart(2,'0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  };
  const openCalendarLinks = async (appId, which) => {
    try {
      const res = await api.get(`/interview/${appId}/meta`);
      const m = res.data || {};
      if (!m.at) return;
      if (which === 'google') {
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(m.title||'Interview')}&dates=${fmtGoogleDate(m.at)}/${fmtGoogleDate(m.end)}&details=${encodeURIComponent(m.description||'')}&location=${encodeURIComponent(m.location||'')}`;
        window.open(url, '_blank');
      } else if (which === 'outlook') {
        const url = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(m.title||'Interview')}&body=${encodeURIComponent(m.description||'')}&startdt=${encodeURIComponent(m.at||'')}&enddt=${encodeURIComponent(m.end||'')}&location=${encodeURIComponent(m.location||'')}`;
        window.open(url, '_blank');
      } else if (which === 'ics') {
        const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        window.open(`${base}/api/interview/${appId}/ics`, '_blank');
      }
    } catch {}
  };

  const setSubmitField = (appId, taskId, key, value) => {
    const k = `${appId}:${taskId}`;
    setSubmitForms((p) => ({ ...p, [k]: { ...(p[k]||{}), [key]: value } }));
  };

  const submitTask = async (appId, taskId) => {
    const k = `${appId}:${taskId}`;
    const cur = submitForms[k] || {};
    const links = (cur.links || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await api.post(`/applications/${appId}/tasks/${taskId}/submit`, {
        submissionText: cur.text || '',
        submissionLinks: links,
      });
      alert('Submitted');
      // reload applications
      const res = await api.get('/applications/me');
      setApps(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to submit');
    }
  };

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
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <button onClick={() => navigate(`/call/${a.id || a._id}`)} className="rounded bg-purple-600 text-white px-3 py-1 text-sm">Join Video Call</button>
                <button onClick={()=>openCalendarLinks(a.id||a._id,'ics')} className="rounded border px-3 py-1 text-xs">ICS</button>
                <button onClick={()=>openCalendarLinks(a.id||a._id,'google')} className="rounded border px-3 py-1 text-xs">Google</button>
                <button onClick={()=>openCalendarLinks(a.id||a._id,'outlook')} className="rounded border px-3 py-1 text-xs">Outlook</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold">Recommended Jobs</h2>
        <div className="mt-2 grid gap-2">
          {recommended.length === 0 && <div className="text-sm text-gray-500">No recommendations yet.</div>}
          {recommended.map((j) => (
            <div key={j.id} className="rounded border p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{j.title} – {j.company}</div>
                <div className="text-xs text-gray-600">{j.location}</div>
              </div>
              <div className="text-xs text-gray-600">Match {j.score}%</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold">My Applications</h2>
        <div className="mt-2 grid gap-2">
          {apps.map((a) => (
            <div key={a.id || a._id} className="rounded border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{a.job?.title} - {a.job?.company}</div>
                  <div className="text-gray-600">Status: {a.status}</div>
                </div>
                <Link to={`/jobs/${a.job?.id || a.job?._id}`} className="underline">View</Link>
              </div>

              {Array.isArray(a.tasks) && a.tasks.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <div className="font-medium mb-2">Tasks</div>
                  <div className="grid gap-3">
                    {a.tasks.map((t) => (
                      <div key={t._id} className="rounded border p-2">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{t.title}</div>
                          <div className="text-xs">{t.status}</div>
                        </div>
                        {t.description && <div className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{t.description}</div>}
                        {Array.isArray(t.attachments) && t.attachments.length > 0 && (
                          <div className="text-xs mt-1">
                            <div className="font-medium">Attachments</div>
                            <ul className="list-disc pl-5">
                              {t.attachments.map((att, i) => (
                                <li key={i}><a href={att.url || att} target="_blank" rel="noreferrer" className="underline">{att.name || att.url || att}</a></li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {t.dueAt && <div className="text-xs text-gray-600 mt-1">Due: {new Date(t.dueAt).toLocaleString()}</div>}

                        {t.status === 'assigned' && (
                          <div className="mt-2 space-y-2">
                            <textarea
                              className="w-full border rounded px-2 py-1 min-h-[80px]"
                              placeholder="Submission text"
                              value={(submitForms[`${a.id||a._id}:${t._id}`]?.text)||''}
                              onChange={(e)=>setSubmitField(a.id||a._id, t._id, 'text', e.target.value)}
                            />
                            <textarea
                              className="w-full border rounded px-2 py-1 min-h-[60px]"
                              placeholder="Submission links (one per line)"
                              value={(submitForms[`${a.id||a._id}:${t._id}`]?.links)||''}
                              onChange={(e)=>setSubmitField(a.id||a._id, t._id, 'links', e.target.value)}
                            />
                            <div className="flex items-center gap-2">
                              <label className="text-xs px-2 py-1 border rounded cursor-pointer">
                                Add files
                                <input type="file" multiple className="hidden" onChange={(e)=>{ const files = e.target.files; uploadTaskFiles(a.id||a._id, t._id, files); e.target.value=''; }} />
                              </label>
                              {uploading[`${a.id||a._id}:${t._id}`] && <span className="text-xs text-gray-500">Uploading…</span>}
                            </div>
                            <div className="flex justify-end">
                              <button onClick={()=>submitTask(a.id||a._id, t._id)} className="px-3 py-1 rounded bg-blue-600 text-white">Submit Task</button>
                            </div>
                          </div>
                        )}
                        {t.status !== 'assigned' && (
                          <div className="text-xs text-gray-600 mt-2">Submitted {t.submittedAt ? new Date(t.submittedAt).toLocaleString() : ''}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
