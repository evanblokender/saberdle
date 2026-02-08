class AntiCheat {
  constructor() {
    this.devToolsOpen = false;
    this.devToolsStrongEvidence = false;
    this.bannedUntil = null;
    this.fingerprint = this.generateSimpleFingerprint();
    this.guessSubmittedThisSession = false;
    this.gameStartTime = Date.now();
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
    const parts = [
      navigator.userAgent,
      screen.width + '×' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.language || 'en'
    ];
    return btoa(parts.join('|')).slice(0, 32);
  }

  // Add the missing encrypt method
  encrypt(data) {
    return btoa(JSON.stringify(data));
  }

  decrypt(data) {
    try {
      return JSON.parse(atob(data));
    } catch {
      return null;
    }
  }

  blockContextMenu() {
    document.addEventListener('contextmenu', e => {
      e.preventDefault();
      return false;
    }, false); // Changed from capture: true to allow normal clicks
  }

  blockDevToolsShortcuts() {
    document.addEventListener('keydown', e => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I','i','J','j','C','c'].includes(e.key)) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
      ) {
        e.preventDefault();
        e.stopPropagation(); // Changed from stopImmediatePropagation
        this.devToolsOpen = true;
        this.devToolsStrongEvidence = true;
        return false;
      }
    }, false); // Changed from capture: true
  }

  startDevToolsDetection() {
    // Check on load
    this.checkDevTools();
    
    // Check on resize
    window.addEventListener('resize', () => this.checkDevTools());
    
    // Periodic check every 2 seconds
    setInterval(() => this.checkDevTools(), 2000);
  }

  checkDevTools() {
    // Method 1: Window size difference
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    
    // Detect if DevTools is docked (causes significant size difference)
    if (widthDiff > 160 || heightDiff > 160) {
      this.devToolsOpen = true;
      this.devToolsStrongEvidence = true;
    }

    // Method 2: Console detection trick
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: () => {
        this.devToolsOpen = true;
        this.devToolsStrongEvidence = true;
      }
    });
    console.log(element);

    // Method 3: Debugger timing (most reliable)
    const before = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const after = performance.now();
    
    if (after - before > 100) {
      this.devToolsOpen = true;
      this.devToolsStrongEvidence = true;
    }
  }

  getTimeTaken() {
    return Date.now() - this.gameStartTime;
  }

  resetTimer() {
    this.gameStartTime = Date.now();
  }

  onGuessSubmitted() {
    this.guessSubmittedThisSession = true;

    // Check if guess was too fast (likely cheating)
    const timeTaken = this.getTimeTaken();
    if (timeTaken < 1000) {
      this.devToolsStrongEvidence = true;
    }

    if (this.devToolsStrongEvidence) {
      this.banUser();
      return false;
    }

    return true;
  }

  checkBanStatus() {
    let banData = this.getCookie('beat_ban') || localStorage.getItem('beat_ban_fp_' + this.fingerprint);

    if (banData) {
      const parsed = this.decrypt(banData);
      if (parsed) {
        this.bannedUntil = new Date(parsed.until);
      } else {
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

    const encoded = this.encrypt(data);

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

  setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 864e5);
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Strict`;
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
