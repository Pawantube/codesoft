import React from 'react';

export default function NotesPane({
  applicationId,
  notes,
  noteText, setNoteText,
  noteTag, setNoteTag,
  noteFilter, setNoteFilter,
  addNote,
  copyToClipboard,
  downloadText,
  recording,
  startRecording,
  stopRecording,
  onAudioFilePick,
  uploadingAudio,
  transcriptText, setTranscriptText,
  saveTranscript,
  savingTranscript,
  summarizeTranscript,
  summarizing,
  transcriptSavedAt,
  summaryText,
}) {
  return (
    <div className="rounded-xl border bg-white p-3 space-y-3 text-gray-900">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <div className="font-semibold text-sm mb-1">Notes</div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Write a quick note" value={noteText} onChange={(e)=>setNoteText(e.target.value)} />
              <select value={noteTag} onChange={(e)=>setNoteTag(e.target.value)} className="border rounded px-2 py-1 text-xs">
                <option value="general">General</option>
                <option value="strength">Strength</option>
                <option value="concern">Concern</option>
                <option value="next_step">Next step</option>
              </select>
              <button onClick={addNote} className="px-3 py-1 rounded bg-gray-900 text-white text-sm">Add</button>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span>Filter:</span>
                <select value={noteFilter} onChange={(e)=>setNoteFilter(e.target.value)} className="border rounded px-2 py-1">
                  <option value="all">All</option>
                  <option value="general">General</option>
                  <option value="strength">Strength</option>
                  <option value="concern">Concern</option>
                  <option value="next_step">Next step</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button className="underline" onClick={()=>copyToClipboard('Notes', (notes||[]).map(n=>`[${n.tag||'general'}] ${n.text}`).join('\n'))}>Copy</button>
                <button className="underline" onClick={()=>downloadText(`notes-${applicationId}.txt`, (notes||[]).map(n=>`[${n.tag||'general'}] ${n.text}`).join('\n'))}>Export</button>
              </div>
            </div>
            <div className="border rounded p-2 max-h-72 overflow-auto text-sm">
              {notes.filter(n=>noteFilter==='all' || n.tag===noteFilter).length === 0 && <div className="text-gray-500">No notes yet.</div>}
              {notes.filter(n=>noteFilter==='all' || n.tag===noteFilter).map((n, idx) => (
                <div key={idx} className="border-b py-1 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div><span className="text-[10px] uppercase tracking-wide text-gray-400 mr-2">{(n.tag||'general').replace('_',' ')}</span>{n.text}</div>
                    <div className="text-[11px] text-gray-500">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              {!recording ? (
                <button onClick={startRecording} className="px-3 py-1 rounded border">Record</button>
              ) : (
                <button onClick={stopRecording} className="px-3 py-1 rounded bg-red-600 text-white">Stop</button>
              )}
              <label className="px-2 py-1 border rounded cursor-pointer">
                Upload audio
                <input type="file" accept="audio/*,video/webm" className="hidden" onChange={onAudioFilePick} />
              </label>
              {uploadingAudio && <span>Uploading…</span>}
            </div>
          </div>
        </div>

        <div className="text-black">
          <div className="font-semibold text-sm mb-1">Transcript</div>
          <textarea className="w-full min-h-[160px] border rounded p-2 text-sm text-black" value={transcriptText} onChange={(e)=>setTranscriptText(e.target.value)} placeholder="Paste the transcript here (or use your call recorder and paste results)…" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button disabled={savingTranscript} onClick={saveTranscript} className="px-3 py-1 rounded border text-sm text-black disabled:opacity-50">{savingTranscript? 'Saving…':'Save Transcript'}</button>
            <button disabled={summarizing} onClick={summarizeTranscript} className="px-3 py-1 rounded bg-purple-600 text-white text-sm disabled:opacity-50">{summarizing? 'Summarizing…':'Summarize'}</button>
            <button className="px-3 py-1 rounded border text-sm text-black" onClick={()=>copyToClipboard('Transcript', transcriptText)}>Copy</button>
            <button className="px-3 py-1 rounded border text-sm text-black" onClick={()=>downloadText(`transcript-${applicationId}.txt`, transcriptText)}>Export</button>
            {transcriptSavedAt && <span className="text-xs text-gray-500">Saved {new Date(transcriptSavedAt).toLocaleTimeString()}</span>}
          </div>
          <div className="mt-3">
            <div className="font-semibold text-sm mb-1 text-black">AI Summary</div>
            <div className="text-sm whitespace-pre-wrap border rounded p-2 min-h-[80px] text-black">{summaryText || '—'}</div>
            <div className="mt-2 flex gap-2 text-sm">
              <button className="px-3 py-1 rounded border text-black" onClick={()=>copyToClipboard('Summary', summaryText)}>Copy</button>
              <button className="px-3 py-1 rounded border text-black" onClick={()=>downloadText(`summary-${applicationId}.txt`, summaryText)}>Export</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
