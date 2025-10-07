// client/src/pages/CandidateDashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";

export default function CandidateDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [apps, setApps] = useState([]);
  const [notes, setNotes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchAll = async () => {
      setLoadingApps(true);
      try {
        const url = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/applications/me`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setApps(Array.isArray(data) ? data : []);
      } finally {
        setLoadingApps(false);
      }

      try {
        const r = await api.get("/notifications");
        setNotes(r.data || []);
      } catch {}

      try {
        const s = await api.get("/coding-sessions");
        setSessions(Array.isArray(s.data) ? s.data : []);
      } catch {}
    };

    fetchAll();
  }, [token]);

  const unread = notes.filter((n) => !n.read).length;

  const markAll = async () => {
    await api.patch("/notifications/read-all");
    const r = await api.get("/notifications");
    setNotes(r.data || []);
  };

  async function openChat(applicationId, otherUserId) {
    if (!applicationId || !otherUserId) {
      alert("Chat not available yet for this application.");
      return;
    }
    const base = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const res = await fetch(`${base}/api/chat/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      credentials: "include",
      body: JSON.stringify({ applicationId, otherUserId }),
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      alert(msg?.error || "Unable to open chat");
      return;
    }
    const convo = await res.json();
    navigate(`/chat?c=${convo._id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">My Applications</h1>

      {loadingApps && <div className="text-sm text-gray-600">Loading applications...</div>}

      <div className="grid gap-3">
        {apps.map((a) => {
          const recruiterId = a.job?.employer?._id || a.job?.employer || null;
          return (
            <div key={a._id} className="border rounded-xl bg-white p-4">
              <div className="font-semibold">{a.job?.title}</div>
              <div className="text-sm text-gray-600">
                {a.job?.company} — {a.job?.location}
              </div>
              <div className="text-sm">
                Status: <span className="font-medium">{a.status}</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  className={`px-3 py-1 rounded bg-black text-white ${recruiterId ? "" : "opacity-50 cursor-not-allowed"}`}
                  disabled={!recruiterId}
                  onClick={() => openChat(a._id, recruiterId)}
                >
                  Message recruiter
                </button>

                {Array.isArray(a.job?.team) &&
                  a.job.team.length > 0 &&
                  a.job.team.map((emp) => {
                    const empId = emp?._id || emp;
                    const label = emp?.name || "Team member";
                    return (
                      <button
                        key={empId}
                        className="px-3 py-1 rounded border hover:bg-gray-50"
                        onClick={() => openChat(a._id, empId)}
                      >
                        Message {label}
                      </button>
                    );
                  })}
                <button
                  className="px-3 py-1 rounded bg-purple-600 text-white"
                  onClick={() => navigate(`/call/${a._id}`)}
                >
                  Join Video Call
                </button>
              </div>
            </div>
          );
        })}
        {!loadingApps && apps.length === 0 && (
          <div className="text-sm text-gray-600">No applications yet.</div>
        )}
      </div>

      <section className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Live Coding Sessions</h2>
          <button onClick={() => navigate("/discover")} className="text-sm text-blue-600 underline">
            Discover opportunities
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">
            No active sessions yet. Your interviewer can start one from the applications page.
          </p>
        ) : (
          <div className="mt-3 grid gap-2">
            {sessions.map((session) => (
              <div
                key={session._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium text-gray-900">{(session.language || 'js').toUpperCase()} session</div>
                  <div className="text-xs text-gray-500">
                    Updated {new Date(session.updatedAt || session.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/coding/${session._id}`)}
                  className="rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Notifications</h2>
          <button onClick={markAll} className="text-sm underline">
            Mark all read
          </button>
        </div>
        <div className="mb-2 text-sm text-gray-500">{unread} unread</div>
        <div className="grid gap-2">
          {notes.map((n) => (
            <div key={n._id} className={`rounded border p-2 ${n.read ? "bg-white" : "bg-gray-100"}`}>
              <div className="font-medium">{n.title}</div>
              <div>{n.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

