import { useState } from 'react'; import { useAuth } from '../context/AuthContext'; import { useNavigate } from 'react-router-dom';
export default function Register(){ const {register}=useAuth(); const [form,setForm]=useState({name:'',email:'',password:'',role:'candidate',companyName:''}); const nav=useNavigate();
  const submit=async(e)=>{ e.preventDefault(); try{ await register(form); nav('/'); }catch{ alert('Register failed'); } };
  return(<form onSubmit={submit} className="max-w-md mx-auto bg-white p-6 rounded-xl border grid gap-3">
    <h1 className="text-xl font-semibold">Create account</h1>
    <input className="border rounded-lg px-3 py-2" placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
    <input className="border rounded-lg px-3 py-2" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/>
    <input className="border rounded-lg px-3 py-2" placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>
    <select className="border rounded-lg px-3 py-2" value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="candidate">Candidate</option><option value="employer">Employer</option></select>
    {form.role==='employer' && <input className="border rounded-lg px-3 py-2" placeholder="Company name" value={form.companyName} onChange={e=>setForm({...form,companyName:e.target.value})}/>}
    <button className="px-4 py-2 rounded-lg bg-gray-900 text-white">Create account</button>
  </form>);
}
