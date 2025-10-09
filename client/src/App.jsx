import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import IncomingCallBanner from './components/IncomingCallBanner';
import InstallPromptBanner from './components/InstallPromptBanner';
import Home from './pages/Home';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import EmployerJobs from './pages/EmployerJobs';
import EditJob from './pages/EditJob';
import EmployerDashboard from './pages/EmployerDashboard';
import EmployerManageJob from './pages/EmployerManageJob';
import VideoFeed from './pages/VideoFeed';
import CandidateDashboardPage from './pages/CandidateDashboardPage';
import PostJob from './pages/PostJob';
import LiveCoding from './pages/LiveCoding';
import LiveCallPage from './pages/LiveCallPage';
import ChatPage from './pages/ChatPage';
import Channels from './pages/Channels';
import Posts from './pages/Posts';
import Screening from './pages/Screening';
import Interested from './pages/Interested';
import AuthProvider, { useAuth } from './context/AuthContext';
import Toaster from './components/Toaster.jsx';

function Protected({ role, children }) {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) return null; // wait until /users/me resolves
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const year = new Date().getFullYear();
  const location = useLocation();
  const onCall = location.pathname.startsWith('/call/');

  return (
    <AuthProvider>
      <div className={onCall ? 'min-h-screen bg-black text-white' : 'min-h-screen bg-gray-50 text-gray-900'}>
        {!onCall && <Navbar />}
        {!onCall && <IncomingCallBanner />}
        <main className={onCall ? 'w-screen h-screen p-0 m-0' : 'mx-auto flex w-full max-w-6xl flex-1 px-4 py-6 sm:px-6'}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/employer" element={<Protected role="employer"><EmployerDashboard /></Protected>} />
            <Route path="/employer/post" element={<Protected role="employer"><PostJob /></Protected>} />
            <Route path="/employer/manage/:id" element={<Protected role="employer"><EmployerManageJob /></Protected>} />
            <Route path="/employer/jobs" element={<Protected role="employer"><EmployerJobs /></Protected>} />
            <Route path="/employer/edit/:id" element={<Protected role="employer"><EditJob /></Protected>} />
            <Route path="/candidate" element={<Protected role="candidate"><CandidateDashboardPage /></Protected>} />
            <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
            <Route path="/discover" element={<Protected><VideoFeed /></Protected>} />
            <Route path="/channels" element={<Protected><Channels /></Protected>} />
            <Route path="/Interested" element={<Protected role="employer"><Interested /></Protected>} />
            <Route path="/posts" element={<Protected><Posts /></Protected>} />
            <Route path="/chat" element={<Protected><ChatPage /></Protected>} />
            <Route path="/call/:id" element={<Protected><div className="min-h-screen flex flex-col"><LiveCallPage /></div></Protected>} />
            <Route path="/screening/:id" element={<Protected role="candidate"><Screening /></Protected>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        {!onCall && <footer className="py-6 text-center text-sm text-gray-500">� {year} SawConnect Job Board</footer>}
        {!onCall && <InstallPromptBanner />}
        <Toaster />
      </div>
    </AuthProvider>
  );
}
