class AntiCheat {
  constructor() {
    this.devToolsOpen = false;
    this.devToolsStrongEvidence = false;   // only this triggers ban potential
    this.bannedUntil = null;
    this.fingerprint = this.generateSimpleFingerprint();
    this.guessSubmittedThisSession = false;
    this.init();
  }

  init() {
    this.checkBanStatus();

    if (this.isBanned()) {
      this.showBanScreen();
      return;
    }

    this.blockContextMenu();
    this.blockDevToolsShortcuts();
    this.startDevToolsDetection();
  }

  generateSimpleFingerprint() {
    // Very basic but stable enough to survive cookie clear
    const parts = [
      navigator.userAgent,
      screen.width + '×' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.language || 'en'
    ];
    return btoa(parts.join('|')).slice(0, 32);
  }

  blockContextMenu() {
    document.addEventListener('contextmenu', e => {
      e.preventDefault();
    }, { capture: true });
  }

  blockDevToolsShortcuts() {
    document.addEventListener('keydown', e => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c'].includes(e.key)) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.devToolsOpen = true;
        this.devToolsStrongEvidence = true;
      }
    }, { capture: true });
  }

  startDevToolsDetection() {
    // Only reliable method left — size difference
    this.checkWindowSize();
    window.addEventListener('resize', () => this.checkWindowSize());

    // Periodic check in case window properties change later
    setInterval(() => this.checkWindowSize(), 3000);
  }

  checkWindowSize() {
    const wDiff = window.outerWidth - window.innerWidth;
    const hDiff = window.outerHeight - window.innerHeight;

    // Very conservative thresholds — requires quite obvious docking
    if (
      (wDiff > 350 && hDiff > 200) ||
      (hDiff > 350 && wDiff > 200) ||
      (wDiff > 500 || hDiff > 500)
    ) {
      this.devToolsOpen = true;
      this.devToolsStrongEvidence = true;
    }
  }

  // Call this when the player submits a guess
  onGuessSubmitted() {
    this.guessSubmittedThisSession = true;

    if (this.devToolsStrongEvidence) {
      this.banUser();
      return false; // block the guess submission
    }

    return true; // allow guess
  }

  checkBanStatus() {
    let banData = this.getCookie('beat_ban') || localStorage.getItem('beat_ban_fp_' + this.fingerprint);

    if (banData) {
      try {
        const parsed = JSON.parse(atob(banData));
        this.bannedUntil = new Date(parsed.until);
      } catch {
        this.clearBanData();
      }
    }
  }

  isBanned() {
    if (!this.bannedUntil) return false;
    if (new Date() < this.bannedUntil) return true;
    this.clearBanData();
    return false;
  }

  banUser() {
    const until = new Date();
    until.setDate(until.getDate() + 7);

    const data = {
      until: until.toISOString(),
      reason: 'devtools_detected',
      fp: this.fingerprint
    };

    const encoded = btoa(JSON.stringify(data));

    this.setCookie('beat_ban', encoded, 7);
    localStorage.setItem('beat_ban_fp_' + this.fingerprint, encoded);

    this.bannedUntil = until;
    this.showBanScreen();
  }

  clearBanData() {
    this.deleteCookie('beat_ban');
    localStorage.removeItem('beat_ban_fp_' + this.fingerprint);
    this.bannedUntil = null;
  }

  showBanScreen() {
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;z-index:999999;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-family:system-ui;">
        <div style="text-align:center;padding:40px;max-width:500px;">
          <div style="font-size:90px;margin-bottom:20px;">🚫</div>
          <h1 style="font-size:36px;color:#e74c3c;margin:0 0 20px;">Banned — 7 days</h1>
          <p style="font-size:18px;margin:0 0 24px;">
            Developer Tools / Inspector usage was detected while playing.
          </p>
          <p style="font-size:17px;color:#aaa;">
            Ban expires: ${this.bannedUntil ? this.bannedUntil.toLocaleString() : 'unknown'}
          </p>
          <p style="margin-top:40px;color:#777;font-size:14px;">
            Play fair next time.
          </p>
        </div>
      </div>
    `;
    document.body.style.overflow = 'hidden';
  }

  // ──────────────────────────────────────────────
  // Cookie helpers
  // ──────────────────────────────────────────────

  setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 864e5);
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Strict;Secure`;
  }

  getCookie(name) {
    const prefix = name + "=";
    for (let c of document.cookie.split(';')) {
      c = c.trim();
      if (c.startsWith(prefix)) return c.substring(prefix.length);
    }
    return null;
  }

  deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;`;
  }
}

// Initialize
window.antiCheat = new AntiCheat();

// ──────────────────────────────────────────────
// Example integration in your game code:
// ──────────────────────────────────────────────
//
// When player clicks "Submit guess":
//
// if (!window.antiCheat.onGuessSubmitted()) {
//   // show message "Cheating detected — guess blocked" or just return
//   return;
// }
//
// ... then send guess to server ...
