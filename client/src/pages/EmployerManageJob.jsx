// client/src/pages/EmployerManageJob.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export default function EmployerManageJob() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState({}); // appId -> { at, notes, sending }
  const [statusFilter, setStatusFilter] = useState('');
  const [taskModals, setTaskModals] = useState({}); // appId -> { open, title, description, dueAt, attachments(string) }
  const [topCandidates, setTopCandidates] = useState([]);
  const [screeningModals, setScreeningModals] = useState({}); // appId -> { open, data, loading }
  const [referrals, setReferrals] = useState([]);
  const [refLoading, setRefLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { jobId: id };
      if (statusFilter) params.status = statusFilter;
      const response = await api.get('/applications/employer', { params });
      setApps(response.data || []);
    } finally {
      setLoading(false);
    }
  };

  // --- Screening helpers ---
  const openScreening = async (appId) => {
    setScreeningModals((p)=>({ ...p, [appId]: { ...(p[appId]||{}), open: true, loading: true } }));
    try {
      const res = await api.get(`/screenings/${appId}`);
      setScreeningModals((p)=>({ ...p, [appId]: { open: true, loading: false, data: res.data||null } }));
    } catch {
      setScreeningModals((p)=>({ ...p, [appId]: { open: true, loading: false, data: null } }));
      alert('No screening found');
    }
  };
  const closeScreening = (appId) => setScreeningModals((p)=>({ ...p, [appId]: { ...(p[appId]||{}), open: false } }));
  const autoEval = async (appId) => {
    setScreeningModals((p)=>({ ...p, [appId]: { ...(p[appId]||{}), loading: true } }));
    try {
      const res = await api.post(`/screenings/${appId}/auto-eval`);
      const evaln = res.data?.evaluation;
      setScreeningModals((p)=>({ ...p, [appId]: { ...(p[appId]||{}), loading: false, data: { ...(p[appId]?.data||{}), evaluation: evaln } } }));
    } catch (e) {
      setScreeningModals((p)=>({ ...p, [appId]: { ...(p[appId]||{}), loading: false } }));
      alert(e?.response?.data?.error || 'Auto-eval failed');
    }
  };
  const exportCSV = (appId) => {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    window.open(`${base}/api/screenings/${appId}/export-csv`, '_blank');
  };

  // --- Referrals helpers ---
  const loadReferrals = async () => {
    setRefLoading(true);
    try {
      const res = await api.get('/referrals', { params: { job: id } });
      setReferrals(Array.isArray(res.data) ? res.data : []);
    } catch { setReferrals([]); }
    finally { setRefLoading(false); }
  };
  const genReferral = async () => {
    try {
      await api.post('/referrals', { jobId: id });
      await loadReferrals();
    } catch (e) { alert(e?.response?.data?.error || 'Failed to create link'); }
  };
  const markPaid = async (refId) => {
    try { await api.post(`/referrals/${refId}/payout`); await loadReferrals(); }
    catch (e) { alert(e?.response?.data?.error || 'Failed to mark paid'); }
  };
  const copyToClipboard = async (text) => { try { await navigator.clipboard.writeText(text||''); alert('Copied'); } catch {} };

  useEffect(() => {
    const fetchRecs = async () => {
      try {
        const res = await api.get('/recommendations/candidates', { params: { job: id } });
        setTopCandidates(Array.isArray(res.data) ? res.data : []);
      } catch {}
    };
    if (id) fetchRecs();
    if (id) loadReferrals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setStatus = async (appId, status) => {
    await api.patch(`/applications/${appId}/status`, { status });
    await load();
  };

  const setInviteField = (appId, key, value) => {
    setInvites((p) => ({ ...p, [appId]: { ...(p[appId]||{}), [key]: value } }));
  };

  const scheduleInvite = async (appId) => {
    const cur = invites[appId] || {};
    if (!cur.at) { alert('Select date & time'); return; }
    setInvites((p) => ({ ...p, [appId]: { ...(p[appId]||{}), sending: true } }));
    try {
      await api.post(`/applications/${appId}/invite`, { at: cur.at, notes: cur.notes||'' });
      await load();
      alert('Interview scheduled');
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to schedule');
    } finally {
      setInvites((p) => ({ ...p, [appId]: { ...(p[appId]||{}), sending: false } }));
    }
  };

  const updateInvite = async (appId, patch) => {
    setInvites((p) => ({ ...p, [appId]: { ...(p[appId]||{}), sending: true } }));
    try {
      await api.patch(`/applications/${appId}/invite`, patch);
      await load();
      alert('Interview updated');
    } catch (e) {
      alert(e?.response?.data?.error || 'Update failed');
    } finally {
      setInvites((p) => ({ ...p, [appId]: { ...(p[appId]||{}), sending: false } }));
    }
  };

  const inviteNow = async (appId) => {
    try {
      await api.post(`/applications/${appId}/invite-now`);
      alert('Invite sent');
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to invite');
    }
  };

  const download = async (application) => {
    try {
      // The API returns either a file or a JSON with {url}
      const res = await api.get(`/applications/${application._id}/resume`, { responseType: 'blob' });
      const contentType = res.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text = await res.data.text();
        const json = JSON.parse(text);
        if (json.url) {
          window.open(json.url, '_blank', 'noopener');
          return;
        }
      }
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(application.candidate?.name || application.name || 'resume').replace(/[^\w.-]+/g,'_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to download');
    }
  };

  const openTaskModal = (appId) => setTaskModals((p) => ({ ...p, [appId]: { open: true, title: '', description: '', dueAt: '', attachments: '' } }));
  const closeTaskModal = (appId) => setTaskModals((p) => ({ ...p, [appId]: { ...(p[appId]||{}), open: false } }));
  const setTaskField = (appId, key, value) => setTaskModals((p) => ({ ...p, [appId]: { ...(p[appId]||{}), [key]: value } }));
  const submitTask = async (appId) => {
    const cur = taskModals[appId] || {};
    if (!cur.title) { alert('Task title required'); return; }
    const attachments = (cur.attachments || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((url) => ({ url }));
    try {
      await api.post(`/applications/${appId}/tasks`, {
        title: cur.title,
        description: cur.description || '',
        dueAt: cur.dueAt || undefined,
        attachments,
      });
      closeTaskModal(appId);
      await load();
      alert('Task assigned');
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to assign task');
    }
  };

  // --- NEW: create/open chat with candidate tied to this application
  const startCodingSession = async (applicationId) => {
    try {
      const response = await api.post('/coding-sessions', {
        applicationId,
        language: 'javascript',
      });
      const session = response.data;
      if (session?._id) {
        navigate(`/coding/${session._id}`);
      }
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || 'Unable to start coding session');
    }
  };

  const startCall = (applicationId) => {
    navigate(`/call/${applicationId}`);
  };

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
  const openChat = async (applicationId, otherUserId) => {
    if (!otherUserId) {
      alert('Candidate user not found for this application.');
      return;
    }
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = api.defaults.headers.common['Authorization'];

      const res = await fetch(`${baseUrl}/api/chat/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ applicationId, otherUserId }), // server policy checks "applied" requirement
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new Error(msg?.error || 'Unable to open chat');
      }

      const convo = await res.json();
      navigate(`/chat?c=${convo._id}`);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Unable to open chat');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Applicants</h1>

      <section className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Top Candidates (AI)</h2>
          <span className="text-xs text-gray-500">Job ID: {id}</span>
        </div>

      {/* Screening Review Modal(s) */}
      {Object.entries(screeningModals).map(([appId, m]) => (
        m?.open ? (
          <div key={appId} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-2xl rounded-xl bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Screening Review</div>
                <button onClick={()=>closeScreening(appId)} className="text-sm">Close</button>
              </div>
              {m.loading && <div className="text-sm text-gray-600">Loading…</div>}
              {!m.loading && !m.data && <div className="text-sm text-gray-600">No screening found for this application.</div>}
              {!m.loading && m.data && (
                <div className="space-y-3">
                  {m.data.videoUrl && (
                    <video src={m.data.videoUrl} controls className="w-full rounded border" />
                  )}
                  <div className="text-xs text-gray-600">Status: {m.data.status}</div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button onClick={()=>autoEval(appId)} className="px-3 py-1 rounded border">Auto-Evaluate</button>
                    <button onClick={()=>exportCSV(appId)} className="px-3 py-1 rounded border">Export CSV</button>
                  </div>
                  {m.data.evaluation && (
                    <div className="rounded border p-2 text-sm">
                      <div className="font-medium">Rubric</div>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        <div>Clarity: {m.data.evaluation?.rubric?.clarity ?? 0}</div>
                        <div>Structure: {m.data.evaluation?.rubric?.structure ?? 0}</div>
                        <div>Technical: {m.data.evaluation?.rubric?.technical ?? 0}</div>
                        <div>Total: {m.data.evaluation?.totalScore ?? 0}</div>
                      </div>
                      {m.data.evaluation?.feedback && (
                        <div className="mt-2 whitespace-pre-wrap">{m.data.evaluation.feedback}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null
      ))}
        <div className="mt-2 grid gap-2">
          {topCandidates.length === 0 && (
            <div className="text-sm text-gray-500">No recommendations yet.</div>
          )}
          {topCandidates.map((c) => (
            <div key={c.id} className="rounded border p-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-600">{c.headline || c.location}</div>
              </div>
              <div className="text-xs text-gray-600">Match {c.score}%</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Referrals & Bounty</h2>
          <div className="flex items-center gap-2">
            <button onClick={genReferral} className="px-3 py-1 rounded border text-sm">Generate Link</button>
            <button onClick={loadReferrals} className="px-3 py-1 rounded border text-sm">Refresh</button>
          </div>
        </div>
        {refLoading && <div className="text-sm text-gray-600 mt-2">Loading…</div>}
        {!refLoading && referrals.length === 0 && (
          <div className="text-sm text-gray-500 mt-2">No referrals yet.</div>
        )}
        <div className="mt-2 grid gap-2">
          {referrals.map((r) => (
            <div key={r._id || r.id} className="rounded border p-3 text-sm flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium">Code: {r.code}</div>
                {r.url && <div className="text-xs text-gray-600 break-all">{r.url}</div>}
                <div className="text-xs text-gray-600">Clicks: {r.clickedCount || 0} • Status: {r.status}</div>
              </div>
              <div className="flex items-center gap-2">
                {r.url && <button onClick={()=>copyToClipboard(r.url)} className="px-2 py-1 rounded border text-xs">Copy URL</button>}
                {r.status !== 'paid' && <button onClick={()=>markPaid(r._id || r.id)} className="px-2 py-1 rounded border text-xs">Mark Paid</button>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <label className="text-sm">Filter:</label>
        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">All</option>
          <option value="submitted">Submitted</option>
          <option value="reviewed">Reviewed</option>
          <option value="on_hold">On hold</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="task_assigned">Task assigned</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        <button onClick={load} className="px-3 py-1 rounded border text-sm">Apply</button>
      </div>

      {loading && <div className="text-sm text-gray-600">Loading…</div>}

      <div className="grid gap-3">
        {apps.map((application) => {
          const hasResume = Boolean(application.resumeFileName || application.resumePublicPath);
          const candidateId =
            application.candidate?._id || // populated case
            application.candidate ||      // fallback if only ObjectId stored
            null;

          return (
            <div key={application._id}>
              <div className="border rounded-xl bg-white p-4 flex flex-col gap-1">
              <div className="font-semibold">
                {application.candidate?.name || application.name}
                <span className="text-xs ml-2 text-gray-600">{application.email}</span>
              </div>

              <div className="text-sm">
                Status: <span className="font-medium">{application.status}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button
                  onClick={() => download(application)}
                  disabled={!hasResume}
                  className={`px-3 py-1 rounded border transition ${
                    hasResume ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  Download Resume
                </button>

                <button onClick={() => setStatus(application._id, 'on_hold')} className="px-3 py-1 rounded border">Hold</button>
                <button onClick={() => setStatus(application._id, 'shortlisted')} className="px-3 py-1 rounded border">Shortlist</button>
                <button onClick={() => setStatus(application._id, 'accepted')} className="px-3 py-1 rounded bg-green-600 text-white">Accept</button>

                <button
                  onClick={() => setStatus(application._id, 'rejected')}
                  className="px-3 py-1 rounded bg-red-600 text-white"
                >
                  Reject
                </button>

                {/* NEW: Message candidate (opens/creates conversation bound to this application) */}
                <button
                  onClick={() => openChat(application._id, candidateId)}
                  disabled={!candidateId}
                  className={`px-3 py-1 rounded bg-black text-white ${
                    candidateId ? '' : 'opacity-50 cursor-not-allowed'
                  }`}
                  title={candidateId ? 'Open chat' : 'Candidate not available'}
                >
                  Message
                </button>

                <button
                  onClick={() => startCodingSession(application._id)}
                  className="px-3 py-1 rounded bg-blue-600 text-white"
                >
                  Start Coding Session
                </button>

                <button
                  onClick={() => startCall(application._id)}
                  className="px-3 py-1 rounded bg-purple-600 text-white"
                >
                  Start Video Call
                </button>

                {/* Calendar quick-links if interview scheduled */}
                {application?.interview?.status === 'scheduled' && (
                  <>
                    <button onClick={()=>openCalendarLinks(application._id,'ics')} className="px-3 py-1 rounded border text-xs">ICS</button>
                    <button onClick={()=>openCalendarLinks(application._id,'google')} className="px-3 py-1 rounded border text-xs">Google</button>
                    <button onClick={()=>openCalendarLinks(application._id,'outlook')} className="px-3 py-1 rounded border text-xs">Outlook</button>
                  </>
                )}

                <button onClick={() => inviteNow(application._id)} className="px-3 py-1 rounded bg-purple-100 text-purple-800 border">Invite Now</button>
                <button onClick={() => openTaskModal(application._id)} className="px-3 py-1 rounded bg-amber-600 text-white">Assign Task</button>
                {/* Screening Actions */}
                <button onClick={() => openScreening(application._id)} className="px-3 py-1 rounded border">View Screening</button>
              </div>

              {!hasResume && (
                <div className="text-xs text-gray-500 mt-1">No resume uploaded for this application.</div>
              )}
              </div>
              {/* Assign Task Modal */}
              {taskModals[application._id]?.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="w-full max-w-lg rounded-xl bg-white p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">Assign Task</div>
                      <button onClick={()=>closeTaskModal(application._id)} className="text-sm">Close</button>
                    </div>
                    <input
                      className="w-full border rounded px-2 py-1"
                      placeholder="Title"
                      value={taskModals[application._id]?.title||''}
                      onChange={(e)=>setTaskField(application._id,'title',e.target.value)}
                    />
                    <textarea
                      className="w-full border rounded px-2 py-1 min-h-[80px]"
                      placeholder="Description"
                      value={taskModals[application._id]?.description||''}
                      onChange={(e)=>setTaskField(application._id,'description',e.target.value)}
                    />
                    <input
                      type="datetime-local"
                      className="w-full border rounded px-2 py-1"
                      value={taskModals[application._id]?.dueAt||''}
                      onChange={(e)=>setTaskField(application._id,'dueAt',e.target.value)}
                    />
                    <textarea
                      className="w-full border rounded px-2 py-1 min-h-[80px]"
                      placeholder="Attachment URLs (one per line)"
                      value={taskModals[application._id]?.attachments||''}
                      onChange={(e)=>setTaskField(application._id,'attachments',e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={()=>closeTaskModal(application._id)} className="px-3 py-1 rounded border">Cancel</button>
                      <button onClick={()=>submitTask(application._id)} className="px-3 py-1 rounded bg-amber-600 text-white">Assign</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <h2 className="font-semibold">Hired</h2>
        <ul className="list-disc pl-6 text-sm">
          {apps
            .filter((app) => app.status === 'accepted')
            .map((app) => (
              <li key={app._id}>{app.candidate?.name || app.name} - {app.email}</li>
            ))}
        </ul>
      </div>

      <div className="mt-6 bg-white border rounded-xl p-4">
        <h2 className="font-semibold">Job Management (placeholder)</h2>
        <p className="text-sm text-gray-600">
          Create projects, assign tasks, set deadlines, and track progress. (UI only - wire up later)
        </p>
        <div className="grid sm:grid-cols-2 gap-2 mt-2">
          <input className="border rounded px-2 py-1" placeholder="Project name" />
          <input className="border rounded px-2 py-1" placeholder="Deadline (YYYY-MM-DD)" />
          <input className="border rounded px-2 py-1" placeholder="Task title" />
          <select className="border rounded px-2 py-1">
            <option>Todo</option>
            <option>In Progress</option>
            <option>Done</option>
          </select>
          <button className="px-3 py-1 rounded bg-gray-900 text-white">Add</button>
        </div>
      </div>
    </div>
  );
}




