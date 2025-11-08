import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../utils/api";
import { getSocket } from "../utils/socket";

const debounce = (fn, delay = 250) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export default function LiveCoding() {
  const { id } = useParams();

  const [session, setSession] = useState(null);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const socketRef = useRef(null);
  const localUpdateRef = useRef(false);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/coding-sessions/${id}`);
      const data = res.data;
      setSession(data);
      setCode(data.code || data.starterCode || "");
      setLanguage(data.language || "javascript");
      setPrompt(data.prompt || "");
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || "Unable to load coding session");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !id) return;
    socketRef.current = socket;

    socket.emit("code:join", { sessionId: id });

    const handleState = (payload) => {
      if (payload.sessionId !== id) return;
      setLanguage(payload.language || "javascript");
      setPrompt(payload.prompt || "");
      setCode(payload.code || "");
      setSession((prev) =>
        prev
          ? {
              ...prev,
              updatedAt: payload.updatedAt,
            }
          : prev
      );
    };

    const handleUpdate = (payload) => {
      if (payload.sessionId !== id) return;
      localUpdateRef.current = true;
      setCode(payload.code || "");
      setSession((prev) =>
        prev
          ? {
              ...prev,
              updatedAt: payload.updatedAt,
            }
          : prev
      );
    };

    socket.on("code:state", handleState);
    socket.on("code:update", handleUpdate);

    return () => {
      socket.emit("code:leave", { sessionId: id });
      socket.off("code:state", handleState);
      socket.off("code:update", handleUpdate);
    };
  }, [id]);

  const broadcastChange = useMemo(
    () =>
      debounce((value) => {
        const socket = socketRef.current;
        if (!socket) return;
        socket.emit("code:update", { sessionId: id, code: value });
      }, 250),
    [id]
  );

  const handleCodeChange = (event) => {
    const value = event.target.value;
    setCode(value);
    localUpdateRef.current = true;
    broadcastChange(value);
  };

  useEffect(() => {
    if (localUpdateRef.current) localUpdateRef.current = false;
  }, [code]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await api.post(`/coding-sessions/${id}/run`, { code, language });
      const payload = res.data || {};
      const text = [payload.output, payload.error].filter(Boolean).join("\n");
      setOutput(text || "(no output)");
      setSession((prev) => (
        prev
          ? { ...prev, runCount: (prev.runCount || 0) + 1, updatedAt: new Date().toISOString() }
          : prev
      ));
    } catch (error) {
      console.error(error);
      setOutput(error?.response?.data?.error || "Execution failed");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Loading session...</div>;
  }

  if (!session) {
    return <div className="p-6 text-sm text-red-600">Session not found or you do not have access.</div>;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4">
      <header className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Live Coding Session</h1>
            <div className="text-sm text-gray-600">
              Language: <span className="font-medium text-gray-900">{language}</span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Runs: <span className="font-medium text-gray-900">{session.runCount ?? 0}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-sm text-gray-700">Select language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="javascript">JavaScript</option>
            <option value="java">Java</option>
          </select>
        </div>
      </header>

      {prompt && <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{prompt}</p>}

      <main className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col rounded-xl border bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold">Editor</div>
          <textarea
            value={code}
            onChange={handleCodeChange}
            spellCheck={false}
            className="min-h-[400px] flex-1 rounded-b-xl bg-gray-900 p-4 font-mono text-sm text-green-100 focus:outline-none"
          />
          <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-3">
            <div className="text-xs text-gray-500">
              Last updated: {new Date(session.updatedAt || Date.now()).toLocaleString()}
            </div>
            <button
              onClick={handleRun}
              disabled={running}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {running ? "Running..." : "Run Code"}
            </button>
          </div>
        </section>

        <section className="flex flex-col rounded-xl border bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold">Output</div>
          <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded-b-xl bg-gray-50 p-4 text-sm text-gray-800">
            {output || "Press Run to execute the current code."}
          </pre>
        </section>
      </main>

      <footer className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">Participants</h2>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
          {(session.participants || []).map((participant) => (
            <span key={participant._id || participant.id || participant} className="rounded-full bg-gray-100 px-3 py-1">
              {participant.name || participant.email || participant}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
