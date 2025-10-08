import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { getSocket } from '../utils/socket';

export default function NotificationsBell({ className = '', showLabel = false, onClick }) {
  const [unread, setUnread] = useState(0);
  let inFlight = false;

  const load = async () => {
    if (inFlight) return; // guard overlapping calls
    inFlight = true;
    try {
      const res = await api.get('/notifications');
      setUnread(res.data.filter((n) => !n.read).length);
    } catch {}
    finally { inFlight = false; }
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    const onNotify = () => setUnread((u) => u + 1);
    socket?.on?.('notify:new', onNotify);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      socket?.off?.('notify:new', onNotify);
      document.removeEventListener('visibilitychange', onVis);
    };
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
