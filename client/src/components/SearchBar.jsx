import { useState } from 'react';
export default function SearchBar({initial='',initialLocation='',onSearch}){
  const [query,setQuery]=useState(initial); const [location,setLocation]=useState(initialLocation);
  const submit=(e)=>{e.preventDefault(); onSearch({q:query,location});};
  return(<form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
    <input className="flex-1 border rounded-lg px-3 py-2" placeholder="Job title or keyword" value={query} onChange={e=>setQuery(e.target.value)}/>
    <input className="sm:w-64 border rounded-lg px-3 py-2" placeholder="Location" value={location} onChange={e=>setLocation(e.target.value)}/>
    <button className="px-4 py-2 rounded-lg bg-gray-900 text-white">Search</button>
  </form>);
}
