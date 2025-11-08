import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import IncomingCallBanner from './components/IncomingCallBanner';
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
            <Route path="/brand/:companySlug" element={<BrandPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/employer" element={<Protected role="employer"><EmployerDashboard /></Protected>} />
            <Route path="/employer/manage/:id" element={<Protected role="employer"><EmployerManageJob /></Protected>} />
            <Route path="/employer/jobs" element={<Protected role="employer"><EmployerJobs /></Protected>} />
            <Route path="/employer/edit/:id" element={<Protected role="employer"><EditJob /></Protected>} />
            <Route path="/employer/brand" element={<Protected role="employer"><BrandEditor /></Protected>} />
            <Route path="/employer/post" element={<Protected role="employer"><PostJob /></Protected>} />
            <Route path="/candidate" element={<Protected role="candidate"><CandidateDashboardPage /></Protected>} />
            <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
            <Route path="/discover" element={<Protected><VideoFeed /></Protected>} />
            <Route path="/channels" element={<Protected><Channels /></Protected>} />
            <Route path="/posts" element={<Protected><Posts /></Protected>} />
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
            <Route path="/chat" element={<Protected><ChatPage /></Protected>} />
            <Route path="/interested" element={<Protected role="employer"><Interested /></Protected>} />
            <Route path="/call/:id" element={<Protected><div className="min-h-screen flex flex-col"><LiveCallPage /></div></Protected>} />
            <Route path="/screening/:id" element={<Protected role="candidate"><Screening /></Protected>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        {!onCall && <footer className="py-6 text-center text-sm text-gray-500">© {year} SawConnect Job Board</footer>}
        {!onCall && <InstallPromptBanner />}
        <Toaster />
      </div>
    </AuthProvider>
  );
}
