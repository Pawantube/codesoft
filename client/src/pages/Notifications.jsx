import { useEffect, useState } from 'react';
import { api } from '../utils/api';

export default function Notifications() {
  const [items, setItems] = useState([]);

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

  useEffect(() => { load().catch(()=>{}); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <button className="text-sm underline" onClick={markAll}>Mark all read</button>
      </div>

      <div className="grid gap-2">
        {items.map(n => (
          <div key={n._id} className={`border rounded p-3 ${n.read ? 'bg-white' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div className="font-medium">{n.title}</div>
              {!n.read && <button onClick={() => markRead(n._id)} className="text-xs underline">Mark read</button>}
            </div>
            <div className="text-sm">{n.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
