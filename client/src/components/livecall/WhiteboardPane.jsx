import React from 'react';

export default function WhiteboardPane({
  canvasRef,
  onClearBoard,
  onCanvasDown,
  onCanvasMove,
  onCanvasUp,
}) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-600">Collaborative whiteboard (synced + persisted)</div>
        <button className="px-2 py-1 border rounded text-sm" onClick={onClearBoard}>Clear</button>
      </div>
      <div className="w-full">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          onMouseDown={onCanvasDown}
          onMouseMove={onCanvasMove}
          onMouseUp={onCanvasUp}
          onMouseLeave={onCanvasUp}
          className="w-full rounded border bg-white"
        />
      </div>
    </div>
  );
}
