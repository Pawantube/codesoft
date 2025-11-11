import React from 'react';

export default function CallHeader({
  applicationId,
  socketId,
  isLeader,
  iceSource,
  apiUrl,
  enableMetered,
  meteredSubdomain,
  error,
  ready,
  joining,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleCamera,
  onShareScreen,
  onAddTimestampedNote,
  muted,
  cameraOff,
  participantsCount,
}) {
  return (
    <div className="rounded-xl border bg-white p-3 shrink-0">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="text-sm">
          <div className="font-semibold">Live Call</div>
          <div className="text-gray-500">Application ID: {applicationId}</div>
          <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <span>Socket: <span className="font-mono">{socketId||'...'}</span></span>
            <span>Leader: <span className="font-mono">{isLeader? 'true':'false'}</span></span>
            <span>ICE: <span className="font-mono">{iceSource||'...'}</span></span>
            <span>API: <span className="font-mono">{String(apiUrl||'')}</span></span>
            <span>ENABLE_METERED: <span className="font-mono">{String(enableMetered||'')}</span></span>
            <span>SUBDOMAIN: <span className="font-mono">{String(meteredSubdomain||'')}</span></span>
          </div>
          {error && <div className="text-red-600">{error}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border px-2 py-0.5 text-xs text-gray-700 bg-gray-50">Participants: {participantsCount}</span>
          {!ready ? (
            <button onClick={onJoin} disabled={joining} className="rounded bg-purple-600 px-3 py-1 text-sm text-white disabled:opacity-50">
              {joining ? 'Joining…' : 'Join Call'}
            </button>
          ) : (
            <>
              <button onClick={onToggleMute} className="rounded border px-3 py-1 text-sm text-black">{muted ? 'Unmute' : 'Mute'}</button>
              <button onClick={onToggleCamera} className="rounded border px-3 py-1 text-sm text-black">{cameraOff ? 'Camera On' : 'Camera Off'}</button>
              <button onClick={onShareScreen} className="rounded border px-3 py-1 text-sm text-black">Share screen</button>
              <button onClick={onAddTimestampedNote} className="rounded border px-3 py-1 text-sm text-black">Add timestamp</button>
              <button onClick={onLeave} className="rounded bg-red-600 px-3 py-1 text-sm text-white">Leave</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
