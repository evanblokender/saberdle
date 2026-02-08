const express = require('express');
const cors = require('cors');
const { Redis } = require('@upstash/redis');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

// Force JSON on all responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const LEADERBOARD_KEY = 'leaderboard:global';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Startup checks
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error('MISSING UPSTASH REDIS URL OR TOKEN — EXITING');
  process.exit(1);
}

console.log('Redis client initialized');

// ────────────────────────────────────────────────
// GET /api/leaderboard
// ────────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const entries = await redis.zrange(LEADERBOARD_KEY, 0, 99, {
      rev: true,
      withscores: true,
    });

    const leaderboard = [];
    for (let i = 0; i < entries.length; i += 2) {
      const username = entries[i];
      const score = Number(entries[i + 1]);
      const info = await redis.hgetall(`user:${username}:info`);

      leaderboard.push({
        username,
        score,
        date: info?.date || null,
        rank: Math.floor(i / 2) + 1,
      });
    }

    res.json({ success: true, data: leaderboard });
  } catch (err) {
    console.error('GET leaderboard error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
});

// ────────────────────────────────────────────────
// POST /api/leaderboard
// ────────────────────────────────────────────────
app.post('/api/leaderboard', async (req, res) => {
  try {
    const { username, score } = req.body;

    if (!username || typeof score !== 'number' || isNaN(score)) {
      return res.status(400).json({ success: false, message: 'Username (string) and numeric score required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ success: false, message: 'Username must be 3–20 characters' });
    }

    const lower = username.toLowerCase().trim();
    const badWords = ['fuck', 'shit', 'bitch', 'ass', 'damn', 'nigger', 'nigga'];
    if (badWords.some(w => lower.includes(w))) {
      return res.status(400).json({ success: false, message: 'Inappropriate username' });
    }

    const normUsername = username.trim();

    let current = 0;
    try {
      const currScore = await redis.zscore(LEADERBOARD_KEY, normUsername);
      current = currScore ? Number(currScore) : 0;
    } catch (e) {
      console.error('Redis zscore failed:', e.message);
      return res.status(500).json({ success: false, message: 'Database error (check score)' });
    }

    if (score <= current) {
      return res.status(400).json({ success: false, message: 'Existing score is higher or equal' });
    }

    try {
      await redis.zadd(LEADERBOARD_KEY, score, normUsername);
    } catch (e) {
      console.error('Redis zadd failed:', e.message);
      return res.status(500).json({ success: false, message: 'Database error (save score)' });
    }

    const date = new Date().toISOString();
    try {
      await redis.hset(`user:${normUsername}:info`, { date, originalUsername: username });
    } catch (e) {
      console.warn('Redis hset failed (non-critical):', e.message);
      // continue anyway
    }

    res.json({
      success: true,
      message: current === 0 ? 'Score submitted!' : 'Score updated!',
      data: { username: normUsername, score, date }
    });
  } catch (err) {
    console.error('POST /api/leaderboard full crash:', err.stack);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────
// DELETE /api/leaderboard/:username
// ────────────────────────────────────────────────
app.delete('/api/leaderboard/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { adminPassword } = req.body;

    if (adminPassword !== ADMIN_PASSWORD) {
      return res.status(403).json({ success: false, message: 'Invalid admin password' });
    }

    const normUsername = username.trim();

    await redis.zrem(LEADERBOARD_KEY, normUsername);
    await redis.del(`user:${normUsername}:info`);

    res.json({ success: true, message: 'Entry deleted' });
  } catch (err) {
    console.error('DELETE error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
});

// ────────────────────────────────────────────────
// Debug + Health
// ────────────────────────────────────────────────
app.get('/api/debug-redis', async (req, res) => {
  try {
    await redis.set('health:ping', 'ok', { ex: 60 });
    const ping = await redis.get('health:ping');
    const size = await redis.zcard(LEADERBOARD_KEY);

    res.json({
      success: true,
      redis: {
        ping_ok: ping === 'ok',
        leaderboard_entries: size,
        env_vars: {
          url: !!process.env.UPSTASH_REDIS_REST_URL,
          token: !!process.env.UPSTASH_REDIS_REST_TOKEN,
          admin: !!ADMIN_PASSWORD
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global fallback error handler (last line before listen)
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR:', err.stack);
  res.status(500).json({ success: false, message: 'Server crashed — check logs' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
