/**
 * leaderboard.js v3.2.0
 * - Session token fetched on load, lives forever while heartbeats are sent
 * - Client sends a heartbeat ping every 20s — if it stops (tab closed, network lost)
 *   the server marks the token dead after 60s grace period
 * - Next API call after disconnect returns 401 → uncloseable ACCESS_TOKEN_EXPIRED dialog
 * - Works with Cloudflare Worker proxy (no SSE/persistent connection needed)
 * - Name lock via cookie on first submit
 * - Admin: delete entries + unlock player name locks
 */

const LEADERBOARD_API_URL = 'https://saberdle-key.evan758321.workers.dev';
const API_TIMEOUT         = 8000;
const COOKIE_NAME         = 'beatdle_username';

// ─── State ────────────────────────────────────────────────────────────────────
let leaderboardData    = [];
let currentUsername    = '';
let sessionToken       = null;
let heartbeatInterval  = null;
let heartbeatMs        = 20000; // default, overridden by server response

// ─── Cookie helpers ───────────────────────────────────────────────────────────
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}
function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

// ─── Fetch with timeout ───────────────────────────────────────────────────────
function fetchWithTimeout(url, options = {}, timeout = API_TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
}

// ─── Authenticated fetch — attaches session token, handles 401 ───────────────
async function authFetch(url, options = {}) {
  if (!sessionToken) {
    window.showSessionExpired?.();
    throw new Error('No session token');
  }

  const headers = {
    ...(options.headers || {}),
    'x-session-token': sessionToken
  };

  const res = await fetchWithTimeout(url, { ...options, headers });

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    if (body.code === 'SESSION_EXPIRED' || body.code === 'SESSION_INVALID') {
      _stopHeartbeat();
      sessionToken = null;
      window.showSessionExpired?.();
      throw new Error('SESSION_EXPIRED');
    }
  }

  return res;
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────
// Pings the server every heartbeatMs to prove the tab is still open.
// If pings stop (tab close, network loss), server marks token dead after grace period.
// On reconnect, the next authFetch will get a 401 and show the expired dialog.
function _startHeartbeat() {
  _stopHeartbeat();
  heartbeatInterval = setInterval(async () => {
    if (!sessionToken) { _stopHeartbeat(); return; }
    try {
      const res = await fetchWithTimeout(`${LEADERBOARD_API_URL}/api/session/heartbeat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken }
      }, 5000);

      if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        if (body.code === 'SESSION_EXPIRED' || body.code === 'SESSION_INVALID') {
          _stopHeartbeat();
          sessionToken = null;
          window.showSessionExpired?.();
        }
      }
    } catch {
      // Network blip — don't show dialog yet, server has grace period
      // If it persists long enough the server will kill the token,
      // and the next real action (play, submit) will surface the 401
    }
  }, heartbeatMs);
}

function _stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// ─── Session Token Management ─────────────────────────────────────────────────
async function fetchSessionToken() {
  window.setLoadingProgress?.(30, 'Connecting to server...');

  const res = await fetchWithTimeout(`${LEADERBOARD_API_URL}/api/session`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) throw new Error('Session request failed: ' + res.status);
  const data = await res.json();
  if (!data.success || !data.token) throw new Error('No token in response');

  sessionToken = data.token;

  // Server tells us how often it expects heartbeats
  if (data.heartbeatInterval) heartbeatMs = data.heartbeatInterval;

  return data.token;
}

// ─── Initialize ───────────────────────────────────────────────────────────────
async function initLeaderboard() {
  window.setLoadingProgress?.(10, 'Checking origin...');

  // Origin enforcement
  const host    = window.location.hostname;
  const allowed = ['evanblokender.org', 'www.evanblokender.org', 'localhost', '127.0.0.1'];
  if (!allowed.includes(host)) {
    console.warn('[Beatdle] Unauthorized origin — leaderboard disabled');
    window.hideLoadingScreen?.();
    return;
  }

  try {
    window.setLoadingProgress?.(20, 'Starting session...');
    await fetchSessionToken();

    // Start heartbeat immediately after getting token
    window.setLoadingProgress?.(50, 'Establishing connection...');
    _startHeartbeat();

    window.setLoadingProgress?.(65, 'Loading leaderboard...');

    // Restore locked username from cookie
    const saved = getCookie(COOKIE_NAME);
    if (saved) {
      currentUsername = saved;
      _applyNameLockUI(saved);
    }

    await loadLeaderboard();
    window.setLoadingProgress?.(90, 'Almost ready...');

  } catch (err) {
    console.error('[Beatdle] Init error:', err);
    // Don't block game — leaderboard just won't work
  }

  window.hideLoadingScreen?.();
}

// ─── Load Leaderboard ─────────────────────────────────────────────────────────
async function loadLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  if (list) list.innerHTML = '<div class="leaderboard-loading">Loading leaderboard...</div>';

  try {
    const res    = await authFetch(`${LEADERBOARD_API_URL}/api/leaderboard`);
    const result = await res.json();

    if (result.success && result.data) {
      leaderboardData = Array.isArray(result.data) ? result.data : [];
      updateLeaderboardDisplay();
    } else {
      if (list) list.innerHTML = '<div class="leaderboard-error">Unable to load leaderboard.</div>';
    }
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') return;
    if (list) list.innerHTML = '<div class="leaderboard-error">Connection error. Try again later.</div>';
  }
}

// ─── Display ──────────────────────────────────────────────────────────────────
function updateLeaderboardDisplay() {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;
  list.innerHTML = '';

  if (!leaderboardData.length) {
    list.innerHTML = '<div class="leaderboard-empty">No scores yet. Be the first!</div>';
    return;
  }

  leaderboardData.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';
    if (entry.username?.toLowerCase() === currentUsername.toLowerCase() && currentUsername) {
      row.classList.add('current-user');
    }

    const medal   = ['🥇', '🥈', '🥉'][i] || '';
    const dateStr = entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A';

    row.innerHTML = `
      <span class="leaderboard-rank">${medal || '#' + (i + 1)}</span>
      <span class="leaderboard-username">${escapeHtml(entry.username || 'Unknown')}</span>
      <span class="leaderboard-score">${entry.score ?? 0}</span>
      <span class="leaderboard-date">${dateStr}</span>
      ${isAdminMode() ? `<button class="leaderboard-delete" data-id="${entry.id}">🗑️</button>` : '<span></span>'}
    `;
    list.appendChild(row);
  });

  if (isAdminMode()) {
    list.querySelectorAll('.leaderboard-delete').forEach(btn => {
      btn.addEventListener('click', e => deleteEntry(e.currentTarget.dataset.id));
    });
  }
}

// ─── Submit Score ─────────────────────────────────────────────────────────────
async function submitToLeaderboard(score) {
  const lockedName = getCookie(COOKIE_NAME);
  const input      = document.getElementById('username-input');
  const username   = lockedName || (input ? input.value.trim() : '');

  if (!username)                                   { showToast('Please enter a username!');           return false; }
  if (username.length < 3 || username.length > 20) { showToast('Username must be 3–20 characters'); return false; }

  try {
    const res    = await authFetch(`${LEADERBOARD_API_URL}/api/leaderboard`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, score })
    });
    const result = await res.json();

    if (result.success) {
      if (!lockedName) {
        setCookie(COOKIE_NAME, username, 365);
        currentUsername = username;
        _applyNameLockUI(username);
      }
      showToast(result.message || 'Score submitted!');
      loadLeaderboard();
      return true;
    } else {
      showToast(result.message || 'Failed to submit score');
      return false;
    }
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') return false;
    showToast('Connection error. Please try again.');
    return false;
  }
}

// ─── Name Lock UI ─────────────────────────────────────────────────────────────
function _applyNameLockUI(name) {
  const input      = document.getElementById('username-input');
  const lockedMsg  = document.getElementById('username-locked-msg');
  const lockedName = document.getElementById('locked-name-display');
  const lockNotice = document.getElementById('username-lock-notice');

  if (input)      { input.value = name; input.disabled = true; input.style.display = 'none'; }
  if (lockedMsg)  { lockedMsg.style.display  = 'block'; }
  if (lockedName) { lockedName.textContent   = name; }
  if (lockNotice) { lockNotice.style.display = 'none'; }
}

// ─── Delete Entry (admin) ─────────────────────────────────────────────────────
async function deleteEntry(id) {
  const pwInput       = document.getElementById('admin-password-input');
  const adminPassword = pwInput?.value || '';
  if (!adminPassword)               { showToast('Enter admin password first'); return; }
  if (!confirm('Delete this entry?')) return;

  try {
    const res    = await authFetch(`${LEADERBOARD_API_URL}/api/leaderboard/${id}`, {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ adminPassword })
    });
    const result = await res.json();
    showToast(result.success ? 'Entry deleted' : (result.message || 'Delete failed'));
    if (result.success) loadLeaderboard();
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') showToast('Connection error.');
  }
}

// ─── Admin: Unlock a player's name lock ──────────────────────────────────────
async function adminUnlockName() {
  const pwInput       = document.getElementById('admin-password-input');
  const usernameInput = document.getElementById('admin-unlock-username');
  const adminPassword = pwInput?.value || '';
  const username      = usernameInput?.value.trim() || '';

  if (!adminPassword) { showToast('Enter admin password first'); return; }
  if (!username)      { showToast('Enter a username to unlock'); return; }

  try {
    const res    = await fetchWithTimeout(`${LEADERBOARD_API_URL}/api/admin/unlock-name`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ adminPassword, username })
    });
    const result = await res.json();
    showToast(result.success ? `✅ "${username}" name lock removed` : (result.message || 'Failed'));
    if (usernameInput) usernameInput.value = '';
  } catch {
    showToast('Connection error during unlock.');
  }
}

// ─── Admin helpers ────────────────────────────────────────────────────────────
function isAdminMode() {
  const pw = document.getElementById('admin-password-input');
  return pw && pw.value.length > 0;
}

function toggleAdminPanel() {
  const panel = document.getElementById('admin-panel');
  if (!panel) return;
  const visible = panel.style.display === 'block';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible) document.getElementById('admin-password-input')?.focus();
}

function onAdminPasswordChange() {
  updateLeaderboardDisplay();
}

// ─── Username prompt ──────────────────────────────────────────────────────────
function showUsernamePrompt() {
  const prompt = document.getElementById('username-prompt');
  if (!prompt) return;
  prompt.style.display = 'block';

  const locked = getCookie(COOKIE_NAME);
  if (locked) {
    _applyNameLockUI(locked);
  } else {
    const input = document.getElementById('username-input');
    if (input) { input.disabled = false; input.style.display = ''; input.focus(); }
    const lockNotice = document.getElementById('username-lock-notice');
    if (lockNotice) lockNotice.style.display = 'block';
  }
}

function hideUsernamePrompt() {
  const prompt = document.getElementById('username-prompt');
  if (prompt) prompt.style.display = 'none';
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

// ─── Export ───────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.leaderboardAPI = {
    init:   initLeaderboard,
    load:   loadLeaderboard,
    submit: submitToLeaderboard,
    showPrompt:  showUsernamePrompt,
    hidePrompt:  hideUsernamePrompt,
    toggleAdmin: toggleAdminPanel,
    onAdminPasswordChange,
    adminUnlockName
  };
}
