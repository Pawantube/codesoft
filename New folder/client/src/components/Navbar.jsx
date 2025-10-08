import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationsBell from './NotificationsBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const toggleMobile = () => setMobileOpen((prev) => !prev);
  const menuButtonLabel = mobileOpen ? 'Close menu' : 'Open menu';

  const renderAuthLinks = (className = '') => {
    if (user) {
      return (
        <button
          onClick={() => { logout().catch(() => {}); setMobileOpen(false); }}
          className={`px-3 py-1 rounded-lg bg-gray-900 text-white text-sm ${className}`.trim()}
        >
          Logout
        </button>
      );
    }
    return (
      <div className={`flex items-center gap-3 ${className}`.trim()}>
        <Link to="/login" className="text-sm" onClick={() => setMobileOpen(false)}>Login</Link>
        <Link to="/register" className="px-3 py-1 bg-gray-900 text-white rounded-lg text-sm" onClick={() => setMobileOpen(false)}>
          Sign up
        </Link>
      </div>
    );
  };

  return (
    <nav className="bg-white shadow-sm sticky top-0 z-30">
      <div className="mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:max-w-6xl">
        <Link to="/" className="font-bold text-lg text-gray-900" onClick={() => setMobileOpen(false)}>SawConnect</Link>

        <button
          type="button"
          className="md:hidden inline-flex flex-col items-center justify-center gap-1 rounded-lg p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
          onClick={toggleMobile}
          aria-expanded={mobileOpen}
          aria-label={menuButtonLabel}
        >
          <span className="sr-only">{menuButtonLabel}</span>
          <span className={`h-0.5 w-6 bg-gray-900 transition-transform ${mobileOpen ? 'translate-y-1.5 rotate-45' : ''}`}></span>
          <span className={`h-0.5 w-6 bg-gray-900 transition-opacity ${mobileOpen ? 'opacity-0' : ''}`}></span>
          <span className={`h-0.5 w-6 bg-gray-900 transition-transform ${mobileOpen ? '-translate-y-1.5 -rotate-45' : ''}`}></span>
        </button>

        <div className="hidden md:flex items-center gap-4 text-sm">
          <Link to="/jobs" className="hover:text-gray-900 text-gray-700">Jobs</Link>
          <Link to="/discover" className="hover:text-gray-900 text-gray-700">Discover</Link>
          <Link to="/channels" className="hover:text-gray-900 text-gray-700">Channels</Link>
          {user?.role === 'employer' && <Link to="/employer" className="hover:text-gray-900 text-gray-700">Dashboard</Link>}
          {user?.role === 'candidate' && <Link to="/candidate" className="hover:text-gray-900 text-gray-700">Dashboard</Link>}
          {user && <Link to="/profile" className="hover:text-gray-900 text-gray-700">Profile</Link>}
          {user && <NotificationsBell />}
          {user?.role === 'employer' && (
            <Link to="/employer/post" className="px-3 py-1 bg-gray-900 text-white rounded-lg text-sm">
              Post a Job
            </Link>
          )}
          {renderAuthLinks()}
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white shadow-lg">
          <div className="px-4 py-4 flex flex-col gap-3 text-sm">
            <Link to="/jobs" onClick={() => setMobileOpen(false)} className="py-1">Jobs</Link>
            <Link to="/discover" onClick={() => setMobileOpen(false)} className="py-1">Discover</Link>
            <Link to="/channels" onClick={() => setMobileOpen(false)} className="py-1">Channels</Link>
            {user?.role === 'employer' && <Link to="/employer" onClick={() => setMobileOpen(false)} className="py-1">Dashboard</Link>}
            {user?.role === 'candidate' && <Link to="/candidate" onClick={() => setMobileOpen(false)} className="py-1">Dashboard</Link>}
            {user && <Link to="/profile" onClick={() => setMobileOpen(false)} className="py-1">Profile</Link>}
            {user && <NotificationsBell showLabel className="py-1" onClick={() => setMobileOpen(false)} />}
            {user?.role === 'employer' && (
              <Link to="/employer/post" onClick={() => setMobileOpen(false)} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-center">
                Post a Job
              </Link>
            )}
            {renderAuthLinks('mt-2')}
          </div>
        </div>
      )}
    </nav>
  );
}
