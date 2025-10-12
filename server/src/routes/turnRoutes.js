// server/src/routes/turnRoutes.js
import express from 'express';
// Using Node 18+ global fetch (no node-fetch dependency required)

const router = express.Router();

// Caching to reduce provider calls (default 55s)
const CACHE_SECONDS = Number(process.env.TURN_CACHE_SECONDS || 55);
let cache = { iceServers: null, expiresAt: 0 };

// Helpers
const getStaticIceFromEnv = () => {
  // Support static TURN from env (works with any provider, including Metered TURN product)
  const stunList = (process.env.STUN_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  const turnList = (process.env.TURN_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  const username = process.env.TURN_USERNAME || '';
  const credential = process.env.TURN_CREDENTIAL || '';
  const ice = [];
  if (stunList.length) stunList.forEach(u => ice.push({ urls: u }));
  if (turnList.length && username && credential) turnList.forEach(u => ice.push({ urls: u, username, credential }));
  return ice.length ? ice : null;
};

const buildProviderUrl = () => {
  const sub = process.env.METERED_SUBDOMAIN || '';
  const pub = process.env.METERED_API_KEY || '';
  const secret = process.env.METERED_SECRET_KEY || '';
  // Provider expects apiKey param; prefer PUBLIC key, fall back to SECRET if needed
  const key = pub || secret;
  if (!sub || !key) return null;
  const url = `https://${sub}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`;
  try {
    const mask = (v)=> v ? (String(v).slice(0,6)+'...'+String(v).slice(-4)) : '';
    console.log('[TURN] Building provider URL with apiKey for sub:', sub, 'key(masked):', mask(key));
  } catch {}
  return url;
};

async function fetchIceServers({ timeoutMs = Number(process.env.TURN_FETCH_TIMEOUT_MS) || 8000 } = {}) {
  const url = buildProviderUrl();
  if (!url) {
    const sub = process.env.METERED_SUBDOMAIN || '';
    const secret = process.env.METERED_SECRET_KEY || '';
    const pub = process.env.METERED_API_KEY || '';
    const mask = (v)=> v ? (String(v).slice(0,6)+'...'+String(v).slice(-4)) : '';
    console.error('[TURN] Missing config. sub:', sub || '(empty)', 'secret?', !!secret, 'apiKey?', !!pub, 'secret(masked):', mask(secret), 'apiKey(masked):', mask(pub));
    const err = new Error('TURN not configured on server');
    err.status = 500;
    throw err;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, { method: 'GET', signal: ac.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = new Error(`TURN provider responded ${res.status}`);
      err.status = res.status;
      err.details = text.slice(0, 400);
      throw err;
    }
    const data = await res.json().catch(() => ({}));

    // Expect { iceServers: [...] }
    if (!Array.isArray(data?.iceServers)) {
      const err = new Error('Invalid response from TURN provider');
      err.status = 502;
      err.details = JSON.stringify(data).slice(0, 400);
      throw err;
    }

    // Normalize/whitelist fields
    const iceServers = data.iceServers
      .map(({ urls, url, username, credential }) => ({
        urls: urls || url, // some providers still send 'url'
        username,
        credential,
      }))
      .filter(s => !!s.urls);

    if (!iceServers.length) {
      const err = new Error('Provider returned empty iceServers');
      err.status = 502;
      throw err;
    }

    return iceServers;
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/turn/credentials  ->  { iceServers: [...] }
router.get('/credentials', async (_req, res) => {
  try {
    // 0) Static TURN/STUN from env
    const staticIce = getStaticIceFromEnv();
    if (staticIce) {
      return res.json({ iceServers: staticIce });
    }

    // Serve from cache if fresh
    if (cache.iceServers && Date.now() < cache.expiresAt) {
      return res.json({ iceServers: cache.iceServers });
    }

    const iceServers = await fetchIceServers();

    // Cache briefly
    cache = {
      iceServers,
      expiresAt: Date.now() + CACHE_SECONDS * 1000,
    };

    return res.json({ iceServers });
  } catch (e) {
    const status = e?.name === 'AbortError' ? 504 : e?.status || 500;
    if (status === 500) {
      console.error('[TURN] Proxy error:', e?.message || e);
    } else {
      console.error('[TURN] Provider error:', status, e?.details || e?.message || '');
    }
    return res.status(status).json({
      error: e?.message || 'Failed to fetch TURN credentials',
      ...(e?.details ? { details: e.details } : {}),
    });
  }
});

export default router;
