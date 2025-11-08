import { Types } from 'mongoose';
import vm from 'vm';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import CodingSession from '../models/CodingSession.js';
import Application from '../models/Application.js';

const ensureParticipant = (session, userId) => {
  const id = String(userId);
  return session.participants.map(String).includes(id);
};

export const updateWhiteboardSnapshot = async (req, res) => {
  const { id } = req.params;
  const { whiteboard } = req.body; // dataURL or JSON string
  const session = await CodingSession.findById(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!ensureParticipant(session, req.user._id)) return res.status(403).json({ error: 'Forbidden' });

  session.whiteboard = typeof whiteboard === 'string' ? whiteboard : '';
  session.lastActivityAt = new Date();
  await session.save();
  res.json({ ok: true });
};

const buildParticipants = (application) => {
  const participants = [application.candidate];
  if (application.job?.employer) participants.push(application.job.employer);
  const team = Array.isArray(application.job?.team) ? application.job.team : [];
  const ids = participants.concat(team).filter(Boolean).map((value) => String(value));
  return [...new Set(ids)].map((value) => new Types.ObjectId(value));
};

const authorize = async ({ applicationId, userId }) => {
  const application = await Application.findById(applicationId).populate({
    path: 'job',
    select: 'employer team',
  });
  if (!application) return { ok: false, reason: 'Application not found' };

  const candidateId = String(application.candidate);
  const employerId = String(application.job?.employer);
  const teamIds = (application.job?.team || []).map(String);
  const user = String(userId);

  if (user !== candidateId && user !== employerId && !teamIds.includes(user)) {
    return { ok: false, reason: 'You are not allowed to start a session for this application' };
  }

  return { ok: true, application };
};

export const createSession = async (req, res) => {
  const { applicationId, language = 'javascript', prompt, starterCode } = req.body;
  const auth = await authorize({ applicationId, userId: req.user._id });
  if (!auth.ok) return res.status(403).json({ error: auth.reason });

  const existing = await CodingSession.findOne({ application: applicationId, status: 'active' }).lean();
  if (existing) return res.json(existing);

  const participants = buildParticipants(auth.application);
  const jobId = auth.application.job?._id || auth.application.job;

  const session = await CodingSession.create({
    application: applicationId,
    job: jobId,
    owner: req.user._id,
    participants,
    language,
    prompt,
    starterCode: starterCode || '',
    code: starterCode || '',
  });

  res.status(201).json(session);
};

export const getSession = async (req, res) => {
  const { id } = req.params;
  const session = await CodingSession.findById(id)
    .populate({ path: 'participants', select: 'name email role avatarUrl' })
    .populate({ path: 'application', select: 'job candidate status' })
    .lean();
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!ensureParticipant(session, req.user._id)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(session);
};

export const listSessions = async (req, res) => {
  const sessions = await CodingSession.find({
    participants: req.user._id,
    status: 'active',
  })
    .sort({ updatedAt: -1 })
    .select('application job language prompt updatedAt createdAt code runCount status')
    .lean();
  res.json(sessions);
};

export const updateCodeSnapshot = async (req, res) => {
  const { id } = req.params;
  const { code } = req.body;
  const session = await CodingSession.findById(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!ensureParticipant(session, req.user._id)) return res.status(403).json({ error: 'Forbidden' });

  session.code = code ?? '';
  session.lastActivityAt = new Date();
  await session.save();

  res.json({ ok: true });
};

export const completeSession = async (req, res) => {
  const { id } = req.params;
  const session = await CodingSession.findById(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!ensureParticipant(session, req.user._id)) return res.status(403).json({ error: 'Forbidden' });

  session.status = 'completed';
  await session.save();
  res.json({ ok: true });
};

const runJavaScript = (code) => {
  const script = new vm.Script(code, { displayErrors: true });
  const sandbox = { consoleOutput: [], console: { log: (...args) => sandbox.consoleOutput.push(args.join(' ')) } };
  const context = vm.createContext(sandbox);
  let result;
  try {
    result = script.runInContext(context, { timeout: 1000, microtaskMode: 'afterEvaluate' });
  } catch (error) {
    return { error: error.message, output: sandbox.consoleOutput.join('\n') };
  }
  return {
    output: sandbox.consoleOutput.concat(result !== undefined ? [String(result)] : []).join('\n'),
  };
};

// Best-effort Java runner using local JDK (javac/java). Intended for small snippets.
// Security note: This executes user code on the server and should only be used in trusted/dev environments.
const runJava = async (code) => {
  // If the snippet lacks a class definition, wrap it in a Main class with a main method
  const needsWrap = !/\bclass\s+\w+/m.test(code);
  const source = needsWrap
    ? `public class Main { public static void main(String[] args) throws Exception { ${code} } }`
    : code;

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'java-run-'));
  const filePath = path.join(tmpRoot, 'Main.java');
  await fs.writeFile(filePath, source, 'utf8');

  const runWithTimeout = (cmd, args, cwd, timeoutMs = 6000) => new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd });
    let stdout = '';
    let stderr = '';
    const killTimer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(killTimer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', () => {
      clearTimeout(killTimer);
      resolve({ code: -1, stdout: '', stderr: 'Failed to spawn process' });
    });
  });

  try {
    // Compile
    const c = await runWithTimeout('javac', ['Main.java'], tmpRoot, 8000);
    if (c.code !== 0) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
      return { error: c.stderr || 'javac failed' };
    }
    // Run
    const r = await runWithTimeout('java', ['Main'], tmpRoot, 6000);
    await fs.rm(tmpRoot, { recursive: true, force: true });
    if (r.code !== 0) return { error: r.stderr || 'java failed', output: r.stdout };
    return { output: r.stdout };
  } catch (e) {
    try { await fs.rm(tmpRoot, { recursive: true, force: true }); } catch {}
  }
};

export const runCode = async (req, res) => {
  const { id } = req.params;
  const { code, language: overrideLang } = req.body || {};
  const session = await CodingSession.findById(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!ensureParticipant(session, req.user._id)) return res.status(403).json({ error: 'Forbidden' });

  const source = code ?? session.code;
  let result;

  const lang = (overrideLang || session.language || 'javascript').toLowerCase();
  if (lang === 'javascript' || lang === 'js') {
    result = runJavaScript(source);
  } else if (lang === 'java') {
    result = await runJava(source);
  } else {
    result = { error: `Language ${lang} is not yet supported.` };
  }

  session.lastActivityAt = new Date();
  session.runCount += 1;
  await session.save();

  res.json({ language: lang, ...result });
};
