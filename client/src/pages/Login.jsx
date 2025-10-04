import { useState } from 'react'; import { useAuth } from '../context/AuthContext'; import { useNavigate } from 'react-router-dom';
export default function Login(){ const {login}=useAuth(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const nav=useNavigate();
  const submit=async(e)=>{ e.preventDefault(); try{ await login(email,password); nav('/'); }catch{ alert('Login failed'); } };
  return(<form onSubmit={submit} className="max-w-md mx-auto bg-white p-6 rounded-xl border grid gap-3">
    <h1 className="text-xl font-semibold">Login</h1>
    <input className="border rounded-lg px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
    <input className="border rounded-lg px-3 py-2" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
    <button className="px-4 py-2 rounded-lg bg-gray-900 text-white">Login</button>
  </form>);
}
