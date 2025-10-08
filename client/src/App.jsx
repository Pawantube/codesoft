import { Route, Routes, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
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
import Interested from './pages/Interested';
import AuthProvider, { useAuth } from './context/AuthContext';

function Protected({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const year = new Date().getFullYear();

  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Navbar />
        <main className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
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
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
            <Route path="/discover" element={<Protected><VideoFeed /></Protected>} />
            <Route path="/channels" element={<Protected><Channels /></Protected>} />
            <Route path="/interested" element={<Protected role="employer"><Interested /></Protected>} />
            <Route path="/posts" element={<Protected><Posts /></Protected>} />
            <Route path="/chat" element={<Protected><ChatPage /></Protected>} />
            <Route path="/coding/:id" element={<Protected><LiveCoding /></Protected>} />
            <Route path="/call/:id" element={<Protected><LiveCallPage /></Protected>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <footer className="py-6 text-center text-sm text-gray-500">� {year} SawConnect Job Board</footer>
        <InstallPromptBanner />
      </div>
    </AuthProvider>
  );
}




