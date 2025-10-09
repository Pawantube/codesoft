const verifyChannelMember = async (channelId, userId) => {
  const channel = await Channel.findById(channelId).select('members visibility').lean();
  if (!channel) return { ok: false, reason: 'Channel not found' };
  const member = channel.members?.find((m) => String(m.user) === String(userId));
  if (!member) return { ok: false, reason: 'Forbidden' };
  return { ok: true, channel, member };
};
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Conversation from "./models/Conversation.js";
import CodingSession from "./models/CodingSession.js";
import Application from "./models/Application.js";
import Channel from "./models/Channel.js";

const verifyCallAccess = async (applicationId, userId) => {
  const application = await Application.findById(applicationId)
    .populate({ path: "job", select: "employer team" })
    .lean();
  if (!application) return { ok: false, reason: "Application not found" };

  const candidateId = String(application.candidate);
  const employerId = String(application.job?.employer || "");
  const teamIds = (application.job?.team || []).map((member) => String(member));
  const current = String(userId);

  if (current === candidateId) return { ok: true, role: "candidate", application };
  if (current === employerId) return { ok: true, role: "employer", application };
  if (teamIds.includes(current)) return { ok: true, role: "team", application };
  return { ok: false, reason: "Forbidden" };
};

const buildCallParticipantsPayload = (sockets, room) =>
  sockets.map((sock) => {
    const meta = sock.data.callRooms?.get(room) || {};
    return {
      userId: sock.user.id,
      role: meta.role || "participant",
      anonymized: Boolean(meta.anonymized),
    };
  });

export function initSocket(httpServer, { corsOrigin }) {
  const io = new Server(httpServer, { cors: { origin: corsOrigin, credentials: true } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Unauthorized"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.id };
      socket.data.callRooms = new Map();
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = String(socket.user.id);
    socket.join(`user:${userId}`);

    socket.on("chat:join", async (conversationId) => {
      try {
        const convo = await Conversation.findById(conversationId).lean();
        if (convo && convo.participants.map(String).includes(userId)) {
          socket.join(`conv:${conversationId}`);
        }
      } catch (error) {
        console.error("chat:join failed", error);
      }
    });

    // Notify a user of an incoming call invitation (out-of-band ring)
    socket.on("call:ring", async ({ applicationId, targetUserId }) => {
      try {
        const check = await verifyCallAccess(applicationId, socket.user.id);
        if (!check.ok || !targetUserId) return;
        // send a ring to the target user's personal room
        io.to(`user:${targetUserId}`).emit("call:ring", {
          applicationId,
          from: socket.user.id,
        });
      } catch (e) {
        // ignore
      }
    });

    // Fallback: ring all authorized peers on the application (candidate, employer, team), excluding sender
    socket.on("call:ring-app", async ({ applicationId }) => {
      try {
        const check = await verifyCallAccess(applicationId, socket.user.id);
        if (!check.ok) return;
        const app = check.application;
        const candidateId = String(app.candidate);
        const employerId = String(app.job?.employer || "");
        const teamIds = (app.job?.team || []).map((x) => String(x));
        const recipients = new Set([candidateId, employerId, ...teamIds]);
        recipients.delete(String(socket.user.id));
        recipients.forEach((uid) => {
          io.to(`user:${uid}`).emit("call:ring", { applicationId, from: socket.user.id });
        });
      } catch (e) {
        // ignore
      }
    });

    socket.on("code:join", async ({ sessionId }) => {
      try {
        const session = await CodingSession.findById(sessionId).lean();
        if (session && session.participants.map(String).includes(userId)) {
          socket.join(`code:${sessionId}`);
          socket.emit("code:state", {
            sessionId,
            code: session.code || "",
            language: session.language,
            prompt: session.prompt || "",
            updatedAt: session.updatedAt,
          });
        }
      } catch (error) {
        console.error("code:join failed", error);
      }
    });

    socket.on("code:leave", ({ sessionId }) => {
      if (!sessionId) return;
      socket.leave(`code:${sessionId}`);
    });

    socket.on("code:update", async ({ sessionId, code }) => {
      if (!sessionId || typeof code !== "string") return;
      try {
        const session = await CodingSession.findById(sessionId).select("participants").lean();
        if (!session || !session.participants.map(String).includes(userId)) return;
        io.to(`code:${sessionId}`).except(socket.id).emit("code:update", {
          sessionId,
          code,
          userId,
          updatedAt: new Date().toISOString(),
        });
        await CodingSession.updateOne(
          { _id: sessionId },
          {
            code,
            lastActivityAt: new Date(),
          }
        );
      } catch (error) {
        console.error("code:update failed", error);
      }
    });

    socket.on("channel:join", async ({ channelId }) => {
      try {
        const result = await verifyChannelMember(channelId, socket.user.id);
        if (!result.ok) {
          socket.emit("channel:error", { channelId, error: result.reason || "Forbidden" });
          return;
        }
        const room = `channel:${channelId}`;
        socket.join(room);
        socket.emit("channel:joined", { channelId });
      } catch (error) {
        console.error("channel:join failed", error);
        socket.emit("channel:error", { channelId, error: "Join failed" });
      }
    });

    socket.on("channel:leave", ({ channelId }) => {
      if (!channelId) return;
      socket.leave(`channel:${channelId}`);
    });

    // typing indicator relay for channels
    socket.on("channel:typing", async ({ channelId }) => {
      try {
        if (!channelId) return;
        const result = await verifyChannelMember(channelId, socket.user.id);
        if (!result.ok) return;
        io.to(`channel:${channelId}`).except(socket.id).emit("channel:typing", {
          channelId,
          user: { _id: socket.user.id },
        });
      } catch (error) {
        // ignore
      }
    });

    socket.on("call:join", async ({ applicationId, anonymized }) => {
      try {
        const check = await verifyCallAccess(applicationId, socket.user.id);
        if (!check.ok) {
          socket.emit("call:error", { applicationId, error: check.reason || "Forbidden" });
          return;
        }

        const room = `call:${applicationId}`;
        socket.join(room);
        socket.data.callRooms.set(room, { role: check.role, anonymized: Boolean(anonymized) });

        const sockets = await io.in(room).fetchSockets();
        const participants = buildCallParticipantsPayload(sockets, room);

        socket.emit("call:participants", {
          applicationId,
          participants,
          role: check.role,
        });

        socket.to(room).emit("call:peer-joined", {
          applicationId,
          userId: socket.user.id,
          role: check.role,
          anonymized: Boolean(anonymized),
        });
      } catch (error) {
        console.error("call:join failed", error);
        socket.emit("call:error", { applicationId, error: "Join failed" });
      }
    });

    socket.on("call:leave", ({ applicationId }) => {
      if (!applicationId) return;
      const room = `call:${applicationId}`;
      if (!socket.data.callRooms.has(room)) return;
      socket.leave(room);
      socket.data.callRooms.delete(room);
      socket.to(room).emit("call:peer-left", { applicationId, userId: socket.user.id });
    });

    socket.on("call:meta", ({ applicationId, anonymized }) => {
      const room = `call:${applicationId}`;
      const meta = socket.data.callRooms.get(room);
      if (!meta) return;
      meta.anonymized = Boolean(anonymized);
      socket.data.callRooms.set(room, meta);
      socket.to(room).emit("call:meta", {
        applicationId,
        userId: socket.user.id,
        anonymized: meta.anonymized,
      });
    });

    const forwardSignal = (eventName) => ({ applicationId, description, candidate }) => {
      const room = `call:${applicationId}`;
      if (!socket.data.callRooms.has(room)) return;
      io.to(room).except(socket.id).emit(eventName, {
        applicationId,
        from: socket.user.id,
        description,
        candidate,
      });
    };

    socket.on("call:offer", forwardSignal("call:offer"));
    socket.on("call:answer", forwardSignal("call:answer"));
    socket.on("call:ice", forwardSignal("call:ice"));

    socket.on("disconnect", () => {
      const rooms = socket.data.callRooms || new Map();
      rooms.forEach((_meta, room) => {
        socket.to(room).emit("call:peer-left", {
          applicationId: room.replace("call:", ""),
          userId: socket.user.id,
        });
      });
    });
  });

  return io;
}



