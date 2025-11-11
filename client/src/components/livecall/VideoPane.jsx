import React from 'react';

export default function VideoPane({ localVideoRef, remoteVideoRef }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 flex-1 min-h-0">
      <div className="w-full aspect-video md:h-full">
        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full rounded-lg border bg-black object-cover" />
      </div>
      <div className="w-full aspect-video md:h-full">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full rounded-lg border bg-black object-cover" />
      </div>
    </div>
  );
}
