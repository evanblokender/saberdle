const LEADERBOARD_API_URL = 'https://saberdle-key.evan758321.workers.dev';
const API_TIMEOUT = 8000;

let leaderboardData = [];
let sessionToken = null;
let heartbeatInterval = null;
let heartbeatMs = 3000;

;(function _installFetchInterceptor() {
  const _native = window.fetch;
  async function _refreshToken() {
    try {
      const res = await _native(`${LEADERBOARD_API_URL}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) return null;
      const d = await res.json();
      return (d.success && d.token) ? d.token : null;
    } catch { return null; }
  }
  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url ?? '');
    if (!url.startsWith(LEADERBOARD_API_URL)) return _native(input, init);
    if (sessionToken) {
      init = { ...init, headers: { ...(init.headers || {}), 'x-session-token': sessionToken } };
    }
    let res = await _native(input, init);
    if (res.status === 401) {
      const body = await res.clone().json().catch(() => ({}));
      if (body.code === 'SESSION_EXPIRED' || body.code === 'SESSION_INVALID') {
        const newToken = await _refreshToken();
        if (newToken) {
          sessionToken = newToken;
          _stopHeartbeat();
          _startHeartbeat();
          init = { ...init, headers: { ...(init.headers || {}), 'x-session-token': newToken } };
          res = await _native(input, init);
        }
      }
    }
    return res;
  };
})();

function fetchWithTimeout(url, options = {}, timeout = API_TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout))
  ]);
}

async function authFetch(url, options = {}) {
  if (!sessionToken) {
    window.showSessionExpired?.();
    throw new Error('No session token');
  }
  const headers = { ...(options.headers || {}), 'x-session-token': sessionToken };
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

function _startHeartbeat() {
  _stopHeartbeat();
  heartbeatInterval = setInterval(async () => {
    if (!sessionToken) { _stopHeartbeat(); return; }
    try {
      const res = await fetchWithTimeout(`${LEADERBOARD_API_URL}/api/session/heartbeat`, {
        method: 'POST',
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
    } catch {}
  }, heartbeatMs);
}

function _stopHeartbeat() {
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
}

async function fetchSessionToken() {
  window.setLoadingProgress?.(30, 'Connecting to server...');
  const res = await fetchWithTimeout(`${LEADERBOARD_API_URL}/api/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Session request failed: ' + res.status);
  const data = await res.json();
  if (!data.success || !data.token) throw new Error('No token in response');
  sessionToken = data.token;
  if (data.heartbeatInterval) heartbeatMs = data.heartbeatInterval;
  return data.token;
}

function _encryptPayload(data) {
  try {
    const json = JSON.stringify(data);
    const key = (sessionToken || 'saberdle').slice(0, 16).padEnd(16, '0');
    let result = '';
    for (let i = 0; i < json.length; i++) {
      result += String.fromCharCode(json.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
  } catch { return null; }
}

async function initLeaderboard() {
  window.setLoadingProgress?.(10, 'Checking origin...');
  const host = window.location.hostname;
  const allowed = ['evanblokender.org', 'www.evanblokender.org', 'localhost', '127.0.0.1'];
  if (!allowed.includes(host)) {
    console.warn('[Saberdle] Unauthorized origin — leaderboard disabled');
    window.hideLoadingScreen?.();
    return;
  }
  try {
    window.setLoadingProgress?.(20, 'Starting session...');
    await fetchSessionToken();
    window.setLoadingProgress?.(50, 'Establishing connection...');
    _startHeartbeat();
    window.setLoadingProgress?.(65, 'Loading leaderboard...');
    await loadLeaderboard();
    window.setLoadingProgress?.(90, 'Almost ready...');
  } catch (err) {
    console.error('[Saberdle] Init error:', err);
  }
  window.hideLoadingScreen?.();

  const _keysDown = new Set();
  document.addEventListener('keydown', (e) => {
    _keysDown.add(e.key);
    if (_keysDown.has('Enter') && _keysDown.has('Backspace')) {
      const existing = document.getElementById('__adminPanel');
      if (existing) {
        existing.style.display = existing.style.display === 'none' ? 'block' : 'none';
      } else {
        _injectAdminPanel();
      }
    }
  });
  document.addEventListener('keyup', (e) => _keysDown.delete(e.key));
}

async function loadLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  if (list) list.innerHTML = '<div class="lb-loading">Loading…</div>';
  try {
    const res = await authFetch(`${LEADERBOARD_API_URL}/api/leaderboard`);
    const result = await res.json();
    if (result.success && result.data) {
      leaderboardData = Array.isArray(result.data) ? result.data : [];
      updateLeaderboardDisplay();
      _updateAdminStats();
      // Update sidebar if available
      if (typeof updateSidebarLeaderboard === 'function') updateSidebarLeaderboard();
    } else {
      if (list) list.innerHTML = '<div class="lb-error">Unable to load leaderboard.</div>';
    }
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') return;
    if (list) list.innerHTML = '<div class="lb-error">Connection error. Try again later.</div>';
  }
}

function updateLeaderboardDisplay() {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;
  list.innerHTML = '';
  if (!leaderboardData.length) {
    list.innerHTML = '<div class="lb-empty">No scores yet. Be the first!</div>';
    return;
  }
  const myUsername = window.googleAuth?.getUsername() || '';
  leaderboardData.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';
    if (entry.banned) row.classList.add('banned-row');
    if (myUsername && entry.username?.toLowerCase() === myUsername.toLowerCase()) {
      row.classList.add('current-user');
    }
    const medal = ['🥇','🥈','🥉'][i] || '';
    const dateStr = entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A';
    row.innerHTML = `
      <span class="leaderboard-rank">${medal || '#'+(i+1)}</span>
      <span class="leaderboard-username">${escapeHtml(entry.username||'Unknown')}</span>
      <span class="leaderboard-score">${entry.score??0}</span>
      <span class="leaderboard-date">${dateStr}</span>
      ${isAdminMode() ? `<div style="display:flex;gap:3px;"><button class="leaderboard-delete" data-id="${entry.id}" title="Delete">🗑️</button><button class="leaderboard-ban-btn" data-id="${entry.id}" data-user="${escapeHtml(entry.username||'')}" title="${entry.banned?'Unban':'Ban'}"> ${entry.banned?'✅':'🔨'}</button></div>` : '<span></span>'}
    `;
    list.appendChild(row);
  });
  if (isAdminMode()) {
    list.querySelectorAll('.leaderboard-delete').forEach(btn => {
      btn.addEventListener('click', e => deleteEntry(e.currentTarget.dataset.id));
    });
    list.querySelectorAll('.leaderboard-ban-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const { id, user } = e.currentTarget.dataset;
        const entry = leaderboardData.find(x => x.id === id);
        if (entry) toggleBan(id, user, !!entry.banned);
      });
    });
  }
}

async function submitToLeaderboard(score) {
  if (!window.googleAuth?.isSignedIn()) {
    showToast('Sign in with Google to submit your score!');
    window.googleAuth?.updateSubmitPromptUI?.();
    return false;
  }
  const username = window.googleAuth.getUsername();
  if (!username) {
    showToast('Claim a username first in Account settings!');
    return false;
  }
  let idToken = window.googleAuth.getIdToken();
  if (!idToken) {
    showToast('Refreshing sign-in…');
    idToken = await window.googleAuth.refreshIdToken?.();
    if (!idToken) {
      showToast('Could not verify sign-in. Please sign out and back in.');
      return false;
    }
  }
  if (!sessionToken) {
    showToast('No server session — refreshing…');
    try { await fetchSessionToken(); } catch { showToast('Could not connect to server.'); return false; }
  }

  const payload = { username, score, idToken };
  const encryptedPayload = _encryptPayload(payload);

  try {
    const res = await authFetch(`${LEADERBOARD_API_URL}/api/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _e: encryptedPayload, username, score, idToken }),
    });
    const result = await res.json();
    if (result.success) {
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

async function deleteEntry(id) {
  const adminPassword = _getAdminPw();
  if (!adminPassword) { _adminLog('Enter admin password first', '#ff6633'); return; }
  if (!confirm('Delete this entry?')) return;
  try {
    const res = await authFetch(`${LEADERBOARD_API_URL}/api/leaderboard/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword })
    });
    const result = await res.json();
    _adminLog(result.success ? '✓ Entry deleted' : (result.message || 'Delete failed'));
    if (result.success) { loadLeaderboard(); showToast('Entry deleted'); }
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') _adminLog('Connection error.', '#ff4444');
  }
}

async function toggleBan(id, username, isBanned) {
  const adminPassword = _getAdminPw();
  if (!adminPassword) { _adminLog('Enter admin password first', '#ff6633'); return; }
  const action = isBanned ? 'unban' : 'ban';
  if (!confirm(`${isBanned ? 'Unban' : 'Ban'} user "${username}"?`)) return;
  try {
    const res = await authFetch(`${LEADERBOARD_API_URL}/api/admin/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword, username, entryId: id })
    });
    const result = await res.json();
    _adminLog(result.success ? `✓ User ${action}ned` : (result.message || `${action} failed`));
    if (result.success) { loadLeaderboard(); showToast(`User ${action}ned`); }
  } catch (err) {
    if (err.message !== 'SESSION_EXPIRED') _adminLog('Connection error.', '#ff4444');
  }
}

async function adminUnlockName(username) {
  const adminPassword = _getAdminPw();
  if (!adminPassword) { _adminLog('Enter admin password first', '#ff6633'); return; }
  if (!username) { _adminLog('Enter a username to unlock', '#ff6633'); return; }
  try {
    const res = await fetchWithTimeout(`${LEADERBOARD_API_URL}/api/admin/unlock-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword, username })
    });
    const result = await res.json();
    _adminLog(result.success ? `✓ "${username}" unlocked` : (result.message || 'Failed'));
    if (result.success) showToast(`Username "${username}" unlocked`);
    return result.success;
  } catch {
    _adminLog('Connection error.', '#ff4444');
    return false;
  }
}

function showUsernamePrompt() {
  const prompt = document.getElementById('username-prompt');
  if (!prompt) return;
  prompt.style.display = 'flex';
  window.googleAuth?.updateSubmitPromptUI();
}

function hideUsernamePrompt() {
  const prompt = document.getElementById('username-prompt');
  if (prompt) prompt.style.display = 'none';
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function isAdminMode() {
  return _adminUnlocked && !!_adminAuthToken;
}

function toggleAdminPanel() {}

let _adminUnlocked = false;
let _adminAuthToken = null;
let _adminPassword = null;
let _adminCursor = 0;
let _adminMenu = 'home';
let _adminStack = [];
let _adminToggles = {};

function _getAdminPw() {
  if (!_adminAuthToken) return '';
  return _adminPassword || '';
}

function _requireAuth(actionName) {
  if (_adminAuthToken && _adminUnlocked) return true;
  _adminLog('⛔ AUTHENTICATION ERROR', '#ff3333');
  const err = document.getElementById('__adm_gate_err');
  if (err) err.textContent = '⛔ Authentication required';
  _adminUnlocked = false;
  _adminAuthToken = null;
  _adminPassword = null;
  _adminRender();
  return false;
}

function _adminLog(msg, col) {
  const el = document.getElementById('__adm_log');
  if (el) { el.style.color = col || '#ffcc44'; el.textContent = '► ' + msg; }
}

function _updateAdminStats() {
  const el = (id) => document.getElementById(id);
  if (el('__adm_s_entries')) el('__adm_s_entries').textContent = leaderboardData.length;
  if (el('__adm_s_top')) el('__adm_s_top').textContent = leaderboardData[0]?.score ?? '—';
  if (el('__adm_s_avg')) {
    const avg = leaderboardData.length
      ? Math.round(leaderboardData.reduce((a, e) => a + (e.score||0), 0) / leaderboardData.length)
      : '—';
    el('__adm_s_avg').textContent = avg;
  }
  if (el('__adm_s_lock')) el('__adm_s_lock').textContent = _adminUnlocked ? 'YES' : 'NO';
}

function _getAdminMenus() {
  return {
    home: {
      title: '⚡ SABERDLE ADMIN',
      items: [
        { label: 'Panel Settings',    type: 'submenu', target: 'settings' },
        { label: '→ Entries',         type: 'submenu', target: 'entries'  },
        { label: 'Player Tools',      type: 'submenu', target: 'players'  },
        { label: 'Leaderboard',       type: 'submenu', target: 'lb'       },
        { label: 'Session & Server',  type: 'submenu', target: 'session'  },
        { label: 'Debug & Tools',     type: 'submenu', target: 'debug'    },
      ]
    },
    settings: {
      title: 'Panel Settings',
      items: [
        { label: 'Ghost Mode (dim)', type: 'toggle', id: 'ghost', action: (on) => { document.getElementById('__adminPanel').style.opacity = on ? '0.15' : '1'; }},
        { label: 'Pin: Top Left',   type: 'action', action: () => _adminPin('tl') },
        { label: 'Pin: Top Right',  type: 'action', action: () => _adminPin('tr') },
        { label: 'Pin: Bot Left',   type: 'action', action: () => _adminPin('bl') },
        { label: 'Pin: Bot Right',  type: 'action', action: () => _adminPin('br') },
        { label: 'Lock Panel',      type: 'action', action: () => {
            _adminUnlocked = false; _adminAuthToken = null; _adminPassword = null;
            document.getElementById('__adm_pw_field').value = '';
            _adminRender(); _adminLog('Panel locked'); updateLeaderboardDisplay();
        }},
        { label: '← Back', type: 'back' },
      ]
    },
    entries: {
      title: '→ Entries',
      items: [
        { label: 'Delete Entry by ID', type: 'action', action: () => {
            const id = prompt('Entry ID to delete:');
            if (id) deleteEntry(id.trim());
        }},
        { label: 'Delete #1 (top)',    type: 'action', action: () => {
            if (!leaderboardData[0]) { _adminLog('No entries', '#ff6633'); return; }
            if (confirm('Delete top entry: ' + leaderboardData[0].username + '?')) deleteEntry(leaderboardData[0].id);
        }},
        { label: 'Ban user by name',   type: 'action', action: async () => {
            const u = prompt('Username to ban:');
            if (u) {
              const entry = leaderboardData.find(e => e.username?.toLowerCase() === u.toLowerCase());
              if (entry) { await toggleBan(entry.id, entry.username, !!entry.banned); }
              else { _adminLog('User not found in leaderboard', '#ff6633'); }
            }
        }},
        { label: 'Show delete+ban btns', type: 'toggle', id: 'showdel', action: () => { updateLeaderboardDisplay(); }},
        { label: '← Back', type: 'back' },
      ]
    },
    players: {
      title: 'Player Tools',
      items: [
        { label: 'Unlock Name (prompt)', type: 'action', action: async () => {
            const u = prompt('Username to unlock:');
            if (u) await adminUnlockName(u.trim());
        }},
        { label: 'Find player in LB', type: 'action', action: () => {
            const u = prompt('Search username:');
            if (!u) return;
            const found = leaderboardData.filter(e => e.username?.toLowerCase().includes(u.toLowerCase()));
            if (found.length) {
              found.forEach((e, i) => console.log(`[ADMIN] #${leaderboardData.indexOf(e)+1} ${e.username} — score: ${e.score} banned: ${!!e.banned}`));
              _adminLog(`Found ${found.length} match(es) → console`);
            } else { _adminLog('No matches for "' + u + '"', '#ff6633'); }
        }},
        { label: 'Count unique players', type: 'action', action: () => {
            const unique = new Set(leaderboardData.map(e => e.username?.toLowerCase())).size;
            _adminLog('Unique players: ' + unique);
        }},
        { label: '← Back', type: 'back' },
      ]
    },
    lb: {
      title: 'Leaderboard',
      items: [
        { label: 'Refresh', type: 'action', action: () => { loadLeaderboard(); _adminLog('Refreshing...'); }},
        { label: 'Log top 10', type: 'action', action: () => {
            leaderboardData.slice(0,10).forEach((e,i) => console.log(`  ${i+1}. ${e.username} — ${e.score}`));
            _adminLog('Top 10 → console');
        }},
        { label: 'Show LB modal', type: 'action', action: () => {
            document.getElementById('leaderboard-modal')?.classList.add('show');
            document.body.classList.add('modal-open');
        }},
        { label: '← Back', type: 'back' },
      ]
    },
    session: {
      title: 'Session & Server',
      items: [
        { label: 'Log session token', type: 'action', action: () => { console.log('[ADMIN] Token:', sessionToken); _adminLog('Token → console'); }},
        { label: 'Heartbeat: ON',     type: 'action', action: () => { _startHeartbeat(); _adminLog('Heartbeat started'); }},
        { label: 'Heartbeat: OFF',    type: 'action', action: () => { if (confirm('Stop heartbeat?')) { _stopHeartbeat(); _adminLog('Heartbeat stopped!', '#ff6633'); } }},
        { label: 'Refresh session',   type: 'action', action: async () => {
            try { await fetchSessionToken(); _startHeartbeat(); _adminLog('Token refreshed'); }
            catch(e) { _adminLog('Refresh failed: ' + e.message, '#ff4444'); }
        }},
        { label: 'Log API URL', type: 'action', action: () => { _adminLog(LEADERBOARD_API_URL); }},
        { label: '← Back', type: 'back' },
      ]
    },
    debug: {
      title: 'Debug & Tools',
      items: [
        { label: 'Dump leaderboardData', type: 'action', action: () => { console.log('[ADMIN] leaderboardData:', leaderboardData); _adminLog('leaderboardData → console'); }},
        { label: 'Toast test', type: 'action', action: () => { showToast('Admin panel toast test ✓'); _adminLog('Toast fired'); }},
        { label: 'Reload page', type: 'action', action: () => { if (confirm('Reload?')) location.reload(); }},
        { label: '← Back', type: 'back' },
      ]
    }
  };
}

function _adminPin(corner) {
  const p = document.getElementById('__adminPanel');
  p.style.top = 'auto'; p.style.left = 'auto'; p.style.right = 'auto'; p.style.bottom = 'auto';
  const pad = '14px';
  if      (corner==='tl') { p.style.top=pad; p.style.left=pad; }
  else if (corner==='tr') { p.style.top=pad; p.style.right=pad; }
  else if (corner==='bl') { p.style.bottom=pad; p.style.left=pad; }
  else if (corner==='br') { p.style.bottom=pad; p.style.right=pad; }
  _adminLog('Pinned ' + corner.toUpperCase());
}

function _adminRender() {
  const panel = document.getElementById('__adminPanel');
  if (!panel) return;
  const loginGate = document.getElementById('__adm_login');
  const mainPanel = document.getElementById('__adm_main');
  if (loginGate && mainPanel) {
    const _reallyUnlocked = _adminUnlocked && !!_adminAuthToken;
    loginGate.style.display = _reallyUnlocked ? 'none' : 'block';
    mainPanel.style.display = _reallyUnlocked ? 'block' : 'none';
    if (!_reallyUnlocked) return;
  }
  const MENUS = _getAdminMenus();
  const menu = MENUS[_adminMenu];
  if (!menu) return;
  document.getElementById('__adm_header').textContent = menu.title;
  const list = document.getElementById('__adm_list');
  list.innerHTML = '<div class="admhint">↑↓ nav  ENTER select  ESC back  DEL close</div>';
  menu.items.forEach((item, i) => {
    const div = document.createElement('div');
    if (item.type === 'info') { div.className = 'admitem adminfo'; div.textContent = item.label; list.appendChild(div); return; }
    div.className = 'admitem' + (i === _adminCursor ? ' admsel' : '');
    const lbl = document.createElement('span');
    lbl.textContent = item.label;
    div.appendChild(lbl);
    if (item.type === 'toggle') {
      const b = document.createElement('span');
      b.className = 'admbadge ' + (_adminToggles[item.id] ? 'admon' : 'admoff');
      b.textContent = _adminToggles[item.id] ? 'ON' : 'OFF';
      div.appendChild(b);
    } else if (item.type === 'submenu') {
      const b = document.createElement('span');
      b.className = 'admbadge admsub';
      b.textContent = '»';
      div.appendChild(b);
    }
    div.addEventListener('click', () => { _adminCursor = i; _adminActivate(); });
    list.appendChild(div);
  });
  _updateAdminStats();
}

function _adminActivate() {
  if (!_requireAuth('activate')) return;
  const MENUS = _getAdminMenus();
  const menu = MENUS[_adminMenu];
  const item = menu?.items[_adminCursor];
  if (!item || item.type === 'info') return;
  if (item.type === 'back') {
    if (_adminStack.length) { _adminMenu = _adminStack.pop(); _adminCursor = 0; _adminRender(); }
    return;
  }
  if (item.type === 'submenu') {
    _adminStack.push(_adminMenu); _adminMenu = item.target; _adminCursor = 0; _adminRender(); return;
  }
  if (item.type === 'toggle') {
    _adminToggles[item.id] = !_adminToggles[item.id];
    try { item.action(_adminToggles[item.id]); } catch(e) { _adminLog('ERR: '+e.message, '#ff4444'); }
    _adminRender(); return;
  }
  if (item.type === 'action') {
    try { item.action(); } catch(e) { _adminLog('ERR: '+e.message, '#ff4444'); }
    _adminRender();
  }
}

function _injectAdminPanel() {
  if (document.getElementById('__adminPanel')) return;
  if (!document.getElementById('__admFont')) {
    const fl = document.createElement('link');
    fl.id = '__admFont'; fl.rel = 'stylesheet';
    fl.href = 'https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&display=swap';
    document.head.appendChild(fl);
  }
  const panel = document.createElement('div');
  panel.id = '__adminPanel';
  panel.innerHTML = `
    <div id="__adm_header">⚡ SABERDLE ADMIN</div>
    <div id="__adm_body">
      <div id="__adm_login">
        <div class="adm_gate_title">🔐 ADMIN</div>
        <div class="adm_gate_sub">Enter password to unlock</div>
        <input id="__adm_pw_field" type="password" class="adm_pw_input" placeholder="Admin password..." autocomplete="off" />
        <button class="adm_pw_btn" id="__adm_pw_submit">UNLOCK →</button>
        <div id="__adm_gate_err" class="adm_gate_err"></div>
      </div>
      <div id="__adm_main" style="display:none;">
        <div id="__adm_stats">
          <div class="adms"><span class="admsl">ENTRIES</span><span id="__adm_s_entries">—</span></div>
          <div class="adms"><span class="admsl">TOP</span><span id="__adm_s_top">—</span></div>
          <div class="adms"><span class="admsl">AVG</span><span id="__adm_s_avg">—</span></div>
          <div class="adms"><span class="admsl">AUTH</span><span id="__adm_s_lock">NO</span></div>
        </div>
        <div id="__adm_list"></div>
        <div id="__adm_log">► Admin panel ready</div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const style = document.createElement('style');
  style.id = '__admStyle';
  style.textContent = `
    #__adminPanel { position:fixed; top:14px; right:14px; width:230px; background:rgba(7,7,15,0.97); border:1px solid #00f5ff30; border-left:3px solid #00f5ff; font-family:'Share Tech Mono',monospace; font-size:11.5px; color:#c0e0ff; z-index:2147483647; box-shadow:3px 3px 0 #000,0 0 28px #00f5ff18; user-select:none; }
    #__adm_header { background:linear-gradient(90deg,#00f5ff20,#080410); color:#00f5ff; padding:5px 9px; font-family:'VT323',monospace; font-size:16px; letter-spacing:1px; border-bottom:1px solid #00f5ff20; text-shadow:0 0 8px #00f5ff80; cursor:move; }
    #__adm_body { padding:4px 0; }
    #__adm_login { padding:10px 10px 8px; text-align:center; }
    .adm_gate_title { font-family:'VT323',monospace; font-size:20px; color:#00f5ff; text-shadow:0 0 10px #00f5ff66; margin-bottom:3px; }
    .adm_gate_sub { font-size:9px; color:#336699; margin-bottom:8px; letter-spacing:.4px; }
    .adm_pw_input { width:100%; background:#0a0a1a; border:1px solid #00f5ff30; border-radius:2px; color:#66ccff; font-family:'Share Tech Mono',monospace; font-size:11px; padding:5px 7px; box-sizing:border-box; outline:none; margin-bottom:6px; }
    .adm_pw_input:focus { border-color:#00f5ff; }
    .adm_pw_btn { width:100%; background:#001122; border:1px solid #00f5ff; border-radius:2px; color:#00f5ff; font-family:'VT323',monospace; font-size:15px; letter-spacing:1px; padding:4px 0; cursor:pointer; }
    .adm_pw_btn:hover { background:#00f5ff15; }
    .adm_gate_err { margin-top:5px; font-size:9.5px; color:#ff4422; min-height:13px; }
    #__adm_stats { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:3px; padding:0 5px 4px; border-bottom:1px solid #00f5ff15; margin-bottom:3px; }
    .adms { background:#090912; border:1px solid #00f5ff10; border-radius:2px; padding:3px 2px; text-align:center; }
    .admsl { display:block; font-size:7px; color:#00f5ff40; letter-spacing:.5px; }
    .adms span:last-child { font-size:10px; color:#66ccff; }
    .admitem { padding:2px 10px 2px 9px; color:#6688aa; cursor:pointer; display:flex; justify-content:space-between; align-items:center; white-space:nowrap; overflow:hidden; transition:background .05s; }
    .admitem:hover { background:rgba(0,245,255,.08); color:#aaddff; }
    .admitem.admsel { background:rgba(0,245,255,.15); color:#00f5ff; border-left:2px solid #00f5ff; padding-left:7px; }
    .admitem.adminfo { color:#00f5ff30; font-size:10px; padding:2px 10px; pointer-events:none; }
    .admbadge { font-size:9px; padding:1px 4px; border-radius:2px; margin-left:5px; flex-shrink:0; }
    .admon { background:#004433; color:#00ff88; }
    .admoff { background:#0a0a12; color:#334455; }
    .admsub { color:#00f5ff; font-size:11px; }
    #__adm_log { border-top:1px solid #00f5ff15; padding:3px 9px 2px; font-size:9.5px; color:#336688; min-height:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .admhint { padding:1px 9px 2px; font-size:8.5px; color:#0a0a14; letter-spacing:.3px; }
  `;
  document.head.appendChild(style);

  async function _attemptUnlock() {
    const pw = document.getElementById('__adm_pw_field').value;
    const err = document.getElementById('__adm_gate_err');
    if (!pw) { err.textContent = 'Enter a password'; return; }
    err.textContent = 'Checking…';
    try {
      const res = await fetchWithTimeout(`${LEADERBOARD_API_URL}/api/leaderboard/__probe__`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-session-token': sessionToken || '' },
        body: JSON.stringify({ adminPassword: pw })
      }, 5000);
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 || data.message?.toLowerCase().includes('unauthorized') || data.message?.toLowerCase().includes('wrong')) {
        err.textContent = '✗ Wrong password';
        document.getElementById('__adm_pw_field').value = '';
        return;
      }
    } catch {}
    _adminAuthToken = btoa(pw + ':' + Date.now() + ':' + Math.random().toString(36));
    _adminPassword = pw;
    _adminUnlocked = true;
    err.textContent = '';
    _adminRender();
    _adminLog('Admin access granted ✓');
    updateLeaderboardDisplay();
    _updateAdminStats();
  }

  document.getElementById('__adm_pw_submit').addEventListener('click', _attemptUnlock);
  document.getElementById('__adm_pw_field').addEventListener('keydown', e => { if (e.key === 'Enter') _attemptUnlock(); });

  let _drag = false, _ox = 0, _oy = 0;
  document.getElementById('__adm_header').addEventListener('mousedown', e => {
    _drag = true;
    _ox = e.clientX - panel.getBoundingClientRect().left;
    _oy = e.clientY - panel.getBoundingClientRect().top;
  });
  document.addEventListener('mousemove', e => {
    if (!_drag) return;
    panel.style.left = (e.clientX - _ox) + 'px';
    panel.style.top = (e.clientY - _oy) + 'px';
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => _drag = false);

  function __admKeys(e) {
    if (!document.getElementById('__adminPanel')) { document.removeEventListener('keydown', __admKeys); return; }
    if (!_adminUnlocked || !_adminAuthToken) return;
    const MENUS = _getAdminMenus();
    const menu = MENUS[_adminMenu];
    function nextIdx(idx, dir) {
      let n = idx, tries = 0;
      do { n = (n + dir + menu.items.length) % menu.items.length; tries++; }
      while (menu.items[n].type === 'info' && tries < menu.items.length);
      return n;
    }
    if      (e.key === 'ArrowUp')   { e.stopPropagation(); _adminCursor = nextIdx(_adminCursor, -1); _adminRender(); }
    else if (e.key === 'ArrowDown') { e.stopPropagation(); _adminCursor = nextIdx(_adminCursor, 1);  _adminRender(); }
    else if (e.key === 'Enter')     { e.stopPropagation(); _adminActivate(); }
    else if (e.key === 'Escape' || e.key === 'Backspace') {
      if (_adminStack.length) { _adminMenu = _adminStack.pop(); _adminCursor = 0; _adminRender(); }
    }
    else if (e.key === 'Delete') {
      panel.remove();
      document.getElementById('__admStyle')?.remove();
    }
  }
  document.addEventListener('keydown', __admKeys);
  _adminRender();
  _updateAdminStats();
  console.log('%c⚡ Saberdle Admin Panel loaded — top-right corner','color:#00f5ff;font-size:13px;font-weight:bold');
}

if (typeof window !== 'undefined') {
  window.leaderboardAPI = {
    init: initLeaderboard,
    load: loadLeaderboard,
    submit: submitToLeaderboard,
    showPrompt: showUsernamePrompt,
    hidePrompt: hideUsernamePrompt,
    toggleAdmin: toggleAdminPanel,
    adminUnlockName,
    deleteEntry,
    toggleBan,
  };
}
