import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { Link } from 'react-router-dom';

export default function NotificationsBell() {
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try {
      const res = await api.get('/notifications');
      setUnread(res.data.filter(n => !n.read).length);
    } catch {}
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 20000); // poll every 20s
    return () => clearInterval(id);
  }, []);

  return (
    <Link to="/notifications" className="relative inline-flex items-center">
      <span className="material-icons-outlined">🔔</span>
      {unread > 0 && (
        <span className="absolute -top-1 -right-2 text-[10px] bg-red-600 text-white rounded-full px-1.5 py-0.5">
          {unread}
        </span>
      )}
    </Link>
  );
}
