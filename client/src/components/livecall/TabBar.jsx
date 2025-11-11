import React from 'react';

export default function TabBar({ tab, setTab, applicationId, googleUrl, outlookUrl }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-sm overflow-x-auto no-scrollbar">
      <button className={`px-3 py-1 rounded whitespace-nowrap ${tab==='video'?'bg-gray-900 text-white':'border text-gray-800'}`} onClick={()=>setTab('video')}>Video</button>
      <button className={`px-3 py-1 rounded whitespace-nowrap ${tab==='code'?'bg-gray-900 text-white':'border text-gray-800'}`} onClick={()=>setTab('code')}>Code</button>
      <button className={`px-3 py-1 rounded whitespace-nowrap ${tab==='whiteboard'?'bg-gray-900 text-white':'border text-gray-800'}`} onClick={()=>setTab('whiteboard')}>Whiteboard</button>
      <button className={`px-3 py-1 rounded whitespace-nowrap ${tab==='notes'?'bg-gray-900 text-white':'border text-gray-800'}`} onClick={()=>setTab('notes')}>Notes</button>
      <button className={`px-3 py-1 rounded whitespace-nowrap ${tab==='scorecard'?'bg-gray-900 text-white':'border text-gray-800'}`} onClick={()=>setTab('scorecard')}>Scorecard</button>
      {/* Calendar */}
      <a
        href={`${(import.meta.env.VITE_API_URL||'http://localhost:5000')}/api/interview/${applicationId}/ics`}
        className="ml-auto px-3 py-1 rounded border bg-white text-gray-900"
      >
        Download ICS
      </a>
      {googleUrl && (
        <a href={googleUrl} target="_blank" rel="noreferrer" className="px-3 py-1 rounded border bg-white text-gray-900">Google</a>
      )}
      {outlookUrl && (
        <a href={outlookUrl} target="_blank" rel="noreferrer" className="px-3 py-1 rounded border bg-white text-gray-900">Outlook</a>
      )}
    </div>
  );
}
