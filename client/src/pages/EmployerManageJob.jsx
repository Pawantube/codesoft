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

                <button onClick={() => inviteNow(application._id)} className="px-3 py-1 rounded bg-purple-100 text-purple-800 border">Invite Now</button>
                <button onClick={() => openTaskModal(application._id)} className="px-3 py-1 rounded bg-amber-600 text-white">Assign Task</button>
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




