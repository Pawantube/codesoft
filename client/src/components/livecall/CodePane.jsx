import React from 'react';
import Editor from '@monaco-editor/react';

export default function CodePane({ code, onChange, sessionId, ensureSession }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-600">Shared editor (synced + persisted)</div>
        {!sessionId && <button onClick={ensureSession} className="text-xs underline">Init session</button>}
      </div>
      <div className="min-h-[360px]">
        <Editor
          height="420px"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={code}
          onChange={(v)=>onChange(v ?? '')}
          options={{ fontSize: 13, minimap: { enabled: false } }}
        />
      </div>
    </div>
  );
}
