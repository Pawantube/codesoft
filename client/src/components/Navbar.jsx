import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationsBell from './NotificationsBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-20">
      <div className="container flex items-center justify-between h-14">
        <Link to="/" className="font-bold text-lg">SawConnect</Link>

        <div className="flex items-center gap-4">
          <Link to="/jobs" className="text-sm">Jobs</Link>
          {user?.role === 'employer' && <Link to="/employer" className="text-sm">Dashboard</Link>}
          {user?.role === 'candidate' && <Link to="/candidate" className="text-sm">Dashboard</Link>}
          {user && <Link to="/profile" className="text-sm">Profile</Link>}
          {user && <NotificationsBell />}

          {user?.role === 'employer' && (
            <Link to="/employer/post" className="px-3 py-1 bg-gray-900 text-white rounded-lg text-sm">Post a Job</Link>
          )}

          {user ? (
            <button onClick={logout} className="px-3 py-1 bg-gray-900 text-white rounded-lg text-sm">Logout</button>
          ) : (
            <>
              <Link to="/login" className="text-sm">Login</Link>
              <Link to="/register" className="px-3 py-1 bg-gray-900 text-white rounded-lg text-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
