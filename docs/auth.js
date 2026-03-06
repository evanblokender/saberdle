/* auth.js v6.0.0 — Google Sign-In + Username Management for Saberdle */

const AUTH_API_URL = 'https://saberdle-key.evan758321.workers.dev';
const GOOGLE_CLIENT_ID = '228857418978-6ans8s7e3iu8ub2koel1r9628c4fdc35.apps.googleusercontent.com';

let _googleUser = null;
let _googleIdToken = null;
let _claimedUsername = null;

async function handleGoogleSignIn(credentialResponse) {
  const idToken = credentialResponse.credential;
  _googleIdToken = idToken;

  const payload = _parseJwt(idToken);
  if (!payload) {
    showToast('Sign in failed — invalid token.');
    return;
  }

  _googleUser = {
    sub: payload.sub,
    name: payload.name,
    email: payload.email,
    picture: payload.picture,
  };

  _saveAuthState();

  try {
    const res = await fetch(`${AUTH_API_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();

    if (data.success) {
      if (data.username) {
        _claimedUsername = data.username;
        _saveAuthState();
      }
    } else if (data.banned) {
      _googleUser = null;
      _googleIdToken = null;
      _clearAuthState();
      _showBanScreen(data.banExpires);
      return;
    }
  } catch (e) {
    console.warn('[Auth] Server verify failed (offline?), proceeding with local state.');
  }

  refreshAuthUI();
  updateHeaderAvatar();
  updateSubmitPromptUI();

  const authModal = document.getElementById('auth-modal');
  if (!authModal?.classList.contains('show')) {
    showToast('Signed in as ' + (_googleUser.name || _googleUser.email));
  }
}

function _parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function signOut() {
  _googleUser = null;
  _googleIdToken = null;
  _claimedUsername = null;
  _clearAuthState();

  if (window.google?.accounts?.id) {
    google.accounts.id.disableAutoSelect();
  }

  refreshAuthUI();
  updateHeaderAvatar();
  updateSubmitPromptUI();

  const authModal = document.getElementById('auth-modal');
  if (authModal?.classList.contains('show')) {
    authModal.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  showToast('Signed out.');
}

async function claimUsername() {
  const input = document.getElementById('auth-username-input');
  const errEl = document.getElementById('auth-username-error');
  const username = input?.value?.trim();

  if (!username) { if (errEl) errEl.textContent = 'Enter a username.'; return; }
  if (username.length < 3 || username.length > 20) { if (errEl) errEl.textContent = 'Must be 3–20 characters.'; return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { if (errEl) errEl.textContent = 'Only letters, numbers, and underscores.'; return; }

  if (!_googleIdToken) { if (errEl) errEl.textContent = 'Not signed in.'; return; }

  const claimBtn = document.getElementById('auth-claim-btn');
  if (claimBtn) { claimBtn.disabled = true; claimBtn.textContent = '...'; }

  try {
    const res = await fetch(`${AUTH_API_URL}/api/auth/claim-username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: _googleIdToken, username }),
    });
    const data = await res.json();

    if (data.success) {
      _claimedUsername = data.username;
      _saveAuthState();
      if (errEl) errEl.textContent = '';
      refreshAuthUI();
      updateSubmitPromptUI();
      showToast('Username @' + _claimedUsername + ' claimed!');
    } else {
      if (errEl) errEl.textContent = data.message || 'Username unavailable.';
    }
  } catch {
    if (errEl) errEl.textContent = 'Connection error. Try again.';
  } finally {
    if (claimBtn) { claimBtn.disabled = false; claimBtn.textContent = 'Claim'; }
  }
}

function refreshAuthUI() {
  const signedOut = document.getElementById('auth-signed-out');
  const signedIn = document.getElementById('auth-signed-in');
  const avatarEl = document.getElementById('auth-user-avatar');
  const nameEl = document.getElementById('auth-user-name');
  const usernameEl = document.getElementById('auth-user-username');
  const setUsernameSection = document.getElementById('auth-set-username');
  const usernameLockedSection = document.getElementById('auth-username-locked');
  const lockedNameEl = document.getElementById('auth-locked-name');
  const signOutBtn = document.getElementById('auth-signout-btn');
  const authTitle = document.getElementById('auth-modal-title');

  if (!_googleUser) {
    if (signedOut) signedOut.style.display = 'block';
    if (signedIn) signedIn.style.display = 'none';
    if (authTitle) authTitle.textContent = 'Sign In';
    return;
  }

  if (signedOut) signedOut.style.display = 'none';
  if (signedIn) signedIn.style.display = 'block';
  if (authTitle) authTitle.textContent = 'Account';

  if (avatarEl) { avatarEl.src = _googleUser.picture || ''; avatarEl.style.display = _googleUser.picture ? 'block' : 'none'; }
  if (nameEl) nameEl.textContent = _googleUser.name || 'Google User';
  if (usernameEl) usernameEl.textContent = _claimedUsername ? '@' + _claimedUsername : 'No username set';

  if (_claimedUsername) {
    if (setUsernameSection) setUsernameSection.style.display = 'none';
    if (usernameLockedSection) usernameLockedSection.style.display = 'block';
    if (lockedNameEl) lockedNameEl.textContent = _claimedUsername;
  } else {
    if (setUsernameSection) setUsernameSection.style.display = 'block';
    if (usernameLockedSection) usernameLockedSection.style.display = 'none';
  }

  if (signOutBtn) {
    signOutBtn.onclick = signOut;
  }

  const claimBtn = document.getElementById('auth-claim-btn');
  if (claimBtn) claimBtn.onclick = claimUsername;
}

function updateHeaderAvatar() {
  const icon = document.getElementById('auth-btn-icon');
  const avatar = document.getElementById('auth-btn-avatar');
  if (!icon || !avatar) return;

  if (_googleUser?.picture) {
    icon.style.display = 'none';
    avatar.src = _googleUser.picture;
    avatar.style.display = 'block';
  } else {
    icon.style.display = 'block';
    avatar.style.display = 'none';
  }
}

function updateSubmitPromptUI() {
  const loginRequired = document.getElementById('up-login-required');
  const submitSection = document.getElementById('up-submit-section');
  const usernameDisplay = document.getElementById('up-username-display');

  if (!_googleUser || !_claimedUsername) {
    if (loginRequired) loginRequired.style.display = 'block';
    if (submitSection) submitSection.style.display = 'none';
  } else {
    if (loginRequired) loginRequired.style.display = 'none';
    if (submitSection) submitSection.style.display = 'block';
    if (usernameDisplay) usernameDisplay.textContent = '@' + _claimedUsername;
  }
}

function isSignedIn() {
  return !!(  _googleUser && _googleIdToken && _claimedUsername);
}

function getUsername() {
  return _claimedUsername || null;
}

function getIdToken() {
  return _googleIdToken || null;
}

async function refreshIdToken() {
  return new Promise((resolve) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      resolve(null);
      return;
    }
    const prevCallback = window.handleGoogleSignIn;
    window.handleGoogleSignIn = (credentialResponse) => {
      window.handleGoogleSignIn = prevCallback;
      _googleIdToken = credentialResponse.credential;
      resolve(_googleIdToken);
    };
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        window.handleGoogleSignIn = prevCallback;
        resolve(null);
      }
    });
  });
}

function _saveAuthState() {
  try {
    if (_googleUser) {
      localStorage.setItem('saberdle_auth', JSON.stringify({
        user: { name: _googleUser.name, picture: _googleUser.picture, sub: _googleUser.sub },
        username: _claimedUsername,
        savedAt: Date.now(),
      }));
    }
  } catch {}
}

function _clearAuthState() {
  try { localStorage.removeItem('saberdle_auth'); } catch {}
}

function _loadAuthState() {
  try {
    const saved = localStorage.getItem('saberdle_auth');
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (!parsed?.user) return;
    if (Date.now() - (parsed.savedAt || 0) > 7 * 24 * 60 * 60 * 1000) {
      _clearAuthState();
      return;
    }
    _googleUser = parsed.user;
    _claimedUsername = parsed.username || null;
  } catch {}
}

function _showBanScreen(expiresISO) {
  const expires = expiresISO ? new Date(expiresISO).toLocaleString() : 'Unknown';
  document.body.innerHTML = `
    <div style="
      position:fixed;inset:0;
      background:linear-gradient(135deg,#07070f 0%,#0d0d1e 100%);
      display:flex;align-items:center;justify-content:center;
      font-family:'Exo 2',sans-serif;z-index:999999;
    ">
      <div style="
        background:#131330;border:1px solid rgba(255,0,128,0.3);
        border-radius:18px;padding:44px 36px;text-align:center;
        max-width:440px;width:90%;box-shadow:0 0 60px rgba(255,0,128,0.15);
      ">
        <div style="font-size:3rem;margin-bottom:14px;">🚫</div>
        <div style="font-family:'Rajdhani',sans-serif;font-size:1.8rem;font-weight:700;color:#ff0080;margin-bottom:12px;letter-spacing:2px;">
          ACCOUNT BANNED
        </div>
        <p style="color:#8888bb;font-size:0.9rem;margin-bottom:16px;line-height:1.6;">
          Your Google account has been banned from Saberdle by an administrator.
        </p>
        <p style="color:#555577;font-size:0.8rem;">Ban expires: ${expires}</p>
      </div>
    </div>
  `;
}

function triggerSignIn() {
  if (!window.google || !window.google.accounts || !window.google.accounts.id) {
    showToast('Google Sign-In still loading, try again.');
    return;
  }
  window.google.accounts.id.renderButton(
    document.getElementById('google-signin-btn'),
    { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', width: 280 }
  );
}

document.addEventListener('DOMContentLoaded', () => {
  _loadAuthState();
  refreshAuthUI();
  updateHeaderAvatar();
});

window.addEventListener('load', () => {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    _initGSI();
  } else {
    const interval = setInterval(() => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        clearInterval(interval);
        _initGSI();
      }
    }, 100);
    setTimeout(() => clearInterval(interval), 10000);
  }
});

function _initGSI() {
  try {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn,
      ux_mode: 'popup',
      context: 'signin',
    });
    window.google.accounts.id.renderButton(
      document.getElementById('google-signin-btn'),
      { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', width: 280 }
    );
    if (_googleUser && !_googleIdToken) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.log('[Auth] Silent token refresh not available — user must interact');
        }
      });
    }
  } catch (e) {
    console.warn('[Auth] GSI init failed:', e);
  }
}

window.googleAuth = {
  signOut,
  claimUsername,
  refreshUI: refreshAuthUI,
  isSignedIn,
  getUsername,
  getIdToken,
  refreshIdToken,
  updateSubmitPromptUI,
  handleSignIn: handleGoogleSignIn,
  triggerSignIn,
};

window.handleGoogleSignIn = handleGoogleSignIn;
