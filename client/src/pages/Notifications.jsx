import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  const load = async () => {
    const res = await api.get('/notifications');
    setItems(res.data);
  };
  const markAll = async () => {
    await api.patch('/notifications/read-all');
    await load();
  };
  const markRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    await load();
  };

  const open = async (n) => {
    if (!n) return;
    try { await markRead(n._id); } catch {}
    if (n.link) {
      // Prefer client-side navigation
      try {
        navigate(n.link);
        return;
      } catch {}
      // Fallback
      window.location.href = n.link;
    }
  };

  useEffect(() => { load().catch(()=>{}); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
      </div>

      <div className="grid gap-2">
        {items.map(n => (
          <button
            key={n._id}
            className={`text-left border rounded p-3 w-full ${n.read ? 'bg-white' : 'bg-gray-50 hover:bg-gray-100'}`}
            onClick={() => open(n)}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium">{n.title}</div>
              {!n.read && <button onClick={(e) => { e.stopPropagation(); markRead(n._id); }} className="text-xs underline">Mark read</button>}
            </div>
            <div className="text-sm">{n.message}</div>
            {n.link && <div className="mt-1 text-xs text-blue-600 underline">Open</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
