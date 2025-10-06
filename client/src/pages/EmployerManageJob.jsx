import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api';

export default function EmployerManageJob() {
  const { id } = useParams();
  const [apps, setApps] = useState([]);

  const load = async () => {
    const response = await api.get('/applications/employer', { params: { jobId: id } });
    setApps(response.data);
  };

  useEffect(() => {
    load().catch(() => {});
  }, [id]);

  const download = async (application) => {
    const token = api.defaults.headers.common['Authorization'];
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const requestUrl = `${baseUrl}/api/applications/${application._id}/resume`;

    try {
      const response = await fetch(requestUrl, {
        headers: token ? { Authorization: token } : {},
        credentials: 'include',
      });

      if (response.status === 200) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (data?.url) {
            window.open(data.url, '_blank', 'noopener');
            await load();
            return;
          }
        }
      }

      if (!response.ok) {
        let message = 'Resume not available';
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch {}
        alert(message);
        return;
      }

      const blob = await response.blob();
      const downloadLink = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      const rawName = application.candidate?.name || application.name || 'resume';
      const safeName = rawName.replace(/[^\w.-]+/g, '_');
      const ext = application.resumeFileName && application.resumeFileName.includes('.')
        ? `.${application.resumeFileName.split('.').pop()}`
        : '.pdf';

      downloadLink.href = objectUrl;
      downloadLink.download = `${safeName}${ext}`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      await load();
    } catch (error) {
      console.error(error);
      alert('Download failed. Please try again.');
    }
  };

  const setStatus = async (appId, status) => {
    await api.patch(`/applications/${appId}/status`, { status });
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Applicants</h1>
      <div className="grid gap-3">
        {apps.map((application) => {
          const hasResume = Boolean(application.resumeFileName || application.resumePublicPath);
          return (
            <div key={application._id} className="border rounded-xl bg-white p-4 flex flex-col gap-1">
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
                  className={`px-3 py-1 rounded border transition ${hasResume ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                >
                  Download Resume
                </button>
                <button
                  onClick={() => setStatus(application._id, 'accepted')}
                  className="px-3 py-1 rounded bg-green-600 text-white"
                >
                  Accept
                </button>
                <button
                  onClick={() => setStatus(application._id, 'rejected')}
                  className="px-3 py-1 rounded bg-red-600 text-white"
                >
                  Reject
                </button>
              </div>
              {!hasResume && (
                <div className="text-xs text-gray-500 mt-1">No resume uploaded for this application.</div>
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
              <li key={app._id}>
                {app.candidate?.name || app.name} - {app.email}
              </li>
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
