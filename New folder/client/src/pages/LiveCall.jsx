import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api";
import { getSocket } from "../utils/socket";
import { useAuth } from "../context/AuthContext";

const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

const debounce = (fn, delay = 250) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

const roleAlias = (role, anonymized, fallbackName) => {
  if (anonymized) {
    if (role === "candidate") return "Candidate";
    if (role === "employer") return "Interviewer";
    return "Panelist";
  }
  return fallbackName || role || "Participant";
};

function VideoTile({ stream, muted, mirrored = false, label }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <div className="relative overflow-hidden rounded-xl border bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${mirrored ? "scale-x-[-1]" : ""}`}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1 text-sm text-white">
        {label}
      </div>
    </div>
  );
}

export default function LiveCall() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?._id || user?.id;

  const [context, setContext] = useState(null);
  const [participantsMeta, setParticipantsMeta] = useState({});
  const [remotePeers, setRemotePeers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [anonymized, setAnonymized] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [localPreviewStream, setLocalPreviewStream] = useState(null);

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const joinOnceRef = useRef(false);

  useEffect(() => {
    const loadApplication = async () => {
      try {
        const res = await api.get(`/applications/${id}`);
        const data = res.data;
        setContext(data);
        if (currentUserId) {
          setParticipantsMeta((prev) => ({
            ...prev,
            [currentUserId]: {
              role: data?.viewerRole || "participant",
              anonymized,
            },
          }));
        }
      } catch (err) {
        console.error(err);
        setError(err?.response?.data?.error || "Unable to load application context");
      }
    };
    loadApplication();
  }, [id, currentUserId, anonymized]);

  const cleanupPeers = useCallback(() => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    setRemotePeers({});
  }, []);

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        cameraStreamRef.current = stream;
        localStreamRef.current = stream;
        setLocalPreviewStream(stream);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Camera and microphone permission is required");
        setLoading(false);
      }
    };

    initMedia();

    return () => {
      stopScreenShare();
      cleanupPeers();
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPeerConnection = useCallback(
    (peerId) => {
      if (peersRef.current.has(peerId)) {
        return peersRef.current.get(peerId);
      }

      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      peersRef.current.set(peerId, pc);

      const localStream = localStreamRef.current;
      if (localStream) {
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      }

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        setRemotePeers((prev) => ({
          ...prev,
          [peerId]: {
            ...(prev[peerId] || {}),
            stream,
          },
        }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit("call:ice", {
            applicationId: id,
            targetUserId: peerId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
          setRemotePeers((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
          pc.close();
          peersRef.current.delete(peerId);
        }
      };

      return pc;
    },
    [id],
  );

  const sendOffer = useCallback(
    async (peerId) => {
      try {
        const pc = createPeerConnection(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit("call:offer", {
          applicationId: id,
          targetUserId: peerId,
          description: offer,
        });
      } catch (err) {
        console.error("Failed to create offer", err);
      }
    },
    [createPeerConnection, id],
  );

  const resolveName = useCallback(
    (userId) => {
      if (!context) return null;
      if (context.candidate?.id === userId) return context.candidate.name;
      if (context.job?.employer?.id === userId) return context.job.employer.name;
      const teamMember = context.job?.team?.find((member) => member.id === userId);
      if (teamMember) return teamMember.name;
      return null;
    },
    [context],
  );

  useEffect(() => {
    if (!localStreamRef.current || joinOnceRef.current) return;
    const socket = getSocket();
    if (!socket) {
      setError("Real-time connection unavailable");
      return;
    }

    socketRef.current = socket;
    joinOnceRef.current = true;

    const handleParticipants = ({ participants, role }) => {
      setParticipantsMeta((prev) => {
        const next = { ...prev };
        participants.forEach((participant) => {
          next[participant.userId] = {
            role: participant.role,
            anonymized: participant.anonymized,
          };
        });
        return next;
      });

      if (role && currentUserId) {
        setParticipantsMeta((prev) => ({
          ...prev,
          [currentUserId]: { role, anonymized },
        }));
      }

      participants
        .filter((participant) => participant.userId !== currentUserId)
        .forEach((participant) => {
          sendOffer(participant.userId);
        });
    };

    const handlePeerJoined = ({ userId: peerId, role, anonymized: peerAnon }) => {
      setParticipantsMeta((prev) => ({
        ...prev,
        [peerId]: { role, anonymized: peerAnon },
      }));
      sendOffer(peerId);
    };

    const handlePeerLeft = ({ userId: peerId }) => {
      const pc = peersRef.current.get(peerId);
      if (pc) pc.close();
      peersRef.current.delete(peerId);
      setRemotePeers((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
      setParticipantsMeta((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    };

    const handleOffer = async ({ from, description }) => {
      try {
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(description);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("call:answer", {
          applicationId: id,
          targetUserId: from,
          description: answer,
        });
      } catch (err) {
        console.error("Failed to handle offer", err);
      }
    };

    const handleAnswer = async ({ from, description }) => {
      try {
        const pc = peersRef.current.get(from);
        if (!pc) return;
        await pc.setRemoteDescription(description);
      } catch (err) {
        console.error("Failed to handle answer", err);
      }
    };

    const handleIce = async ({ from, candidate }) => {
      try {
        const pc = peersRef.current.get(from);
        if (!pc || !candidate) return;
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.error("Failed to add ICE candidate", err);
      }
    };

    const handleMeta = ({ userId: peerId, anonymized: peerAnon }) => {
      setParticipantsMeta((prev) => ({
        ...prev,
        [peerId]: {
          ...(prev[peerId] || {}),
          anonymized: peerAnon,
        },
      }));
    };

    const handleError = ({ error: message }) => {
      setError(message || "Call error");
    };

    socket.on("call:participants", handleParticipants);
    socket.on("call:peer-joined", handlePeerJoined);
    socket.on("call:peer-left", handlePeerLeft);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice", handleIce);
    socket.on("call:meta", handleMeta);
    socket.on("call:error", handleError);

    socket.emit("call:join", { applicationId: id, anonymized });

    return () => {
      socket.emit("call:leave", { applicationId: id });
      socket.off("call:participants", handleParticipants);
      socket.off("call:peer-joined", handlePeerJoined);
      socket.off("call:peer-left", handlePeerLeft);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice", handleIce);
      socket.off("call:meta", handleMeta);
      socket.off("call:error", handleError);
      joinOnceRef.current = false;
    };
  }, [id, currentUserId, anonymized, createPeerConnection, sendOffer]);

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    setMuted(!muted);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !cameraOff;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    setCameraOff(!cameraOff);
  };

  const stopScreenShare = useCallback(() => {
    const cameraStream = cameraStreamRef.current;
    if (!cameraStream) return;

    const [cameraTrack] = cameraStream.getVideoTracks();
    peersRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
      if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
    });

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    setLocalPreviewStream(cameraStream);
    setScreenSharing(false);
  }, []);

  const startScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const [screenTrack] = displayStream.getVideoTracks();
      if (!screenTrack) return;

      peersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });

      screenStreamRef.current = displayStream;
      setLocalPreviewStream(displayStream);

      screenTrack.onended = () => stopScreenShare();
      setScreenSharing(true);
    } catch (err) {
      console.error(err);
      alert("Screen share failed");
    }
  };

  const handleAnonymizeToggle = () => {
    const next = !anonymized;
    setAnonymized(next);
    socketRef.current?.emit("call:meta", { applicationId: id, anonymized: next });
    if (currentUserId) {
      setParticipantsMeta((prev) => ({
        ...prev,
        [currentUserId]: {
          ...(prev[currentUserId] || { role: context?.viewerRole || "participant" }),
          anonymized: next,
        },
      }));
    }
  };

  const hangUp = () => {
    stopScreenShare();
    socketRef.current?.emit("call:leave", { applicationId: id });
    cleanupPeers();
    navigate(-1);
  };

  const remoteTiles = useMemo(
    () =>
      Object.entries(remotePeers).map(([peerId, data]) => {
        const meta = participantsMeta[peerId] || {};
        const label = roleAlias(meta.role, meta.anonymized, resolveName(peerId));
        return <VideoTile key={peerId} stream={data.stream} muted={false} label={label} />;
      }),
    [remotePeers, participantsMeta, resolveName],
  );

  const myMeta = participantsMeta[currentUserId] || { role: context?.viewerRole || "participant" };
  const myLabel = roleAlias(myMeta.role, anonymized, resolveName(currentUserId));

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Preparing devices...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <header className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Live Interview Call</h1>
            <div className="text-sm text-gray-600">
              {context?.job?.title ? `${context.job.title} • ${context.job.company}` : "Application call"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAnonymizeToggle}
              className={`rounded-lg border px-3 py-1 text-sm ${anonymized ? "bg-gray-900 text-white" : "text-gray-700"}`}
            >
              {anonymized ? "Anonymized" : "Show identity"}
            </button>
            <button
              onClick={hangUp}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Leave Call
            </button>
          </div>
        </div>
      </header>

      <main className="grid gap-4 lg:grid-cols-2">
        <VideoTile stream={localPreviewStream} muted mirrored label={`${myLabel || "You"} (You)`} />
        <div className="grid gap-3">
          {remoteTiles.length ? (
            remoteTiles
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border bg-white text-sm text-gray-500">
              Waiting for others to join…
            </div>
          )}
        </div>
      </main>

      <footer className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={toggleMute}
            className={`rounded-lg border px-4 py-2 text-sm ${muted ? "bg-gray-900 text-white" : "text-gray-700"}`}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={toggleCamera}
            className={`rounded-lg border px-4 py-2 text-sm ${cameraOff ? "bg-gray-900 text-white" : "text-gray-700"}`}
          >
            {cameraOff ? "Turn Camera On" : "Turn Camera Off"}
          </button>
          <button
            onClick={screenSharing ? stopScreenShare : startScreenShare}
            className="rounded-lg border px-4 py-2 text-sm text-gray-700"
          >
            {screenSharing ? "Stop Sharing" : "Share Screen"}
          </button>
        </div>
      </footer>
    </div>
  );
}
