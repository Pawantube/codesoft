import { Route, Routes, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
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
import CandidateDashboard from './pages/CandidateDashboard';
import PostJob from './pages/PostJob';
import AuthProvider, { useAuth } from './context/AuthContext';

function Protected({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App(){
  return(<AuthProvider>
    <div className="min-h-screen flex flex-col">
      <Navbar/>
      <main className="container py-6 flex-1">
        <Routes>
          <Route path="/" element={<Home/>}/>
          <Route path="/jobs" element={<Jobs/>}/>
          <Route path="/jobs/:id" element={<JobDetail/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/register" element={<Register/>}/>
          <Route path="/employer" element={<Protected role="employer"><EmployerDashboard/></Protected>}/>
          <Route path="/employer/post" element={<Protected role="employer"><PostJob/></Protected>}/>
          <Route path="/employer/manage/:id" element={<Protected role="employer"><EmployerManageJob/></Protected>}/>
          <Route path="/candidate" element={<Protected role="candidate"><CandidateDashboard/></Protected>}/>
          <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
<Route path="/profile" element={<Protected><Profile /></Protected>} />
<Route path="/employer/jobs" element={<Protected role="employer"><EmployerJobs /></Protected>} />
<Route path="/employer/edit/:id" element={<Protected role="employer"><EditJob /></Protected>} />
		  <Route path="*" element={<Navigate to="/"/>}/>

        </Routes>
      </main>
      <footer className="text-center text-sm text-gray-500 py-6">© {new Date().getFullYear()} JobBoard</footer>
    </div>
  </AuthProvider>);
}