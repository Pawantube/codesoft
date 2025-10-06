import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';

export default function NotificationsBell({ className = '', showLabel = false, onClick }) {
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try {
      const res = await api.get('/notifications');
      setUnread(res.data.filter((n) => !n.read).length);
    } catch {}
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, []);

  const classes = ['relative inline-flex items-center text-gray-700'];
  if (showLabel) classes.push('gap-2 text-sm font-medium');
  if (className) classes.push(className);

  return (
    <Link to="/notifications" className={classes.join(' ')} onClick={onClick}>
      <span className="material-icons-outlined text-xl">🔔</span>
      {showLabel && <span></span>}
      {unread > 0 && (
        <span className="absolute -top-1 -right-2 text-[10px] bg-red-600 text-white rounded-full px-1.5 py-0.5">
          {unread}
        </span>
      )}
    </Link>
  );
}
