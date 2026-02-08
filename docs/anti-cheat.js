// Anti-Cheat Protection System – Improved 2026 version
// Goal: make casual cheating annoying / detectable, persist across refresh, hide answer better

class AntiCheat {
  constructor() {
    this.detectionScore = 0;           // 0–10, higher = more sure devtools used
    this.bannedUntil = null;
    this.fingerprint = this.generateFingerprint();
    this.answerHash = null;            // Will hold a hash – never plaintext answer
    this.checkInterval = null;
    this.aggressiveActive = false;

    this.init();
  }

  generateFingerprint() {
    // Simple but effective fingerprint to tie ban to device/browser
    const data = [
      navigator.userAgent,
      navigator.language,
      screen.width + '×' + screen.height,
      new Date().getTimezoneOffset(),
      !!window.chrome,
      'ontouchstart' in window,
    ].join('|');
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  init() {
    this.checkBanStatus();

    if (this.isBanned()) {
      this.showBanScreen();
      return;
    }

    // Block obvious things early
    this.blockContextMenu();
    this.blockDevtoolsShortcuts();

    // Start multi-method detection
    this.startDetection();

    // Hook guess submission (you must call antiCheat.checkOnGuess() before sending/validating guess)
  }

  blockContextMenu() {
    document.addEventListener('contextmenu', e => e.preventDefault(), { capture: true });
  }

  blockDevtoolsShortcuts() {
    document.addEventListener('keydown', e => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.addSuspicion(3);
      }
    }, { capture: true });
  }

  startDetection() {
    // Multiple lightweight checks – increase suspicion score
    const checks = [
      () => this.checkToStringTamper(),           // +2
      () => this.checkDebuggerTiming(),           // +4 if pauses
      () => this.checkGetterTrap(),               // +3
      () => this.checkWindowDimensions(),         // +2 (conservative)
      () => this.checkConsolePrototype(),         // +2
    ];

    this.checkInterval = setInterval(() => {
      checks.forEach(check => check());
      if (this.detectionScore >= 6) {
        this.onDevToolsDetected();
      }
    }, 800); // slower to reduce overhead
  }

  addSuspicion(points) {
    this.detectionScore += points;
    if (this.detectionScore > 12) this.detectionScore = 12;
  }

  checkToStringTamper() {
    if (Function.prototype.toString.toString().includes('native')) return;
    this.addSuspicion(2);
  }

  checkDebuggerTiming() {
    const start = performance.now();
    debugger;
    const end = performance.now();
    if (end - start > 40) { // adjusted threshold 2026
      this.addSuspicion(4);
    }
  }

  checkGetterTrap() {
    let triggered = 0;
    const obj = {};
    Object.defineProperty(obj, 'prop', {
      get: () => { triggered++; return 42; }
    });

    console.log(obj.prop); // only triggers getter if inspecting in console
    setTimeout(() => {
      if (triggered > 1) this.addSuspicion(3);
    }, 300);
  }

  checkWindowDimensions() {
    const diffW = window.outerWidth - window.innerWidth;
    const diffH = window.outerHeight - window.innerHeight;
    if (diffW > 180 && diffH > 180) {
      this.addSuspicion(2);
    }
  }

  checkConsolePrototype() {
    if (console.log.toString().includes('bound')) {
      this.addSuspicion(2);
    }
  }

  onDevToolsDetected() {
    if (this.aggressiveActive) return;
    this.aggressiveActive = true;

    // Persist detection across refresh
    localStorage.setItem(`antiCheatSusp_${this.fingerprint}`, Date.now().toString());

    // Light disruption first
    this.scrambleConsole();
    this.injectJunkLogs();

    // Only if very sure → heavier
    if (this.detectionScore >= 9) {
      this.scrambleDOMLight();
      this.pauseHeavy();
    }
  }

  scrambleConsole() {
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog('%cSTOP – cheating detected – refresh will NOT help', 'color:#f00;font-size:18px');
      for (let i = 0; i < 8; i++) originalLog('🚫');
      originalLog(...args);
    };
  }

  injectJunkLogs() {
    setInterval(() => {
      console.log('%c'.repeat( Math.random()*800 ), 'font-size:1px');
    }, 400);
  }

  scrambleDOMLight() {
    setInterval(() => {
      document.querySelectorAll('[class*="answer"], [id*="answer"]').forEach(el => {
        el.className += ` x${Math.random().toString(36).slice(2,8)}`;
      });
    }, 1200);
  }

  pauseHeavy() {
    // Instead of infinite loop → just freeze input after detection
    document.body.style.pointerEvents = 'none';
    setTimeout(() => { document.body.style.pointerEvents = ''; }, 15000); // temporary
  }

  // ──────────────────────────────────────────────
  //           ANSWER PROTECTION – most important
  // ──────────────────────────────────────────────

  // Call this when you RECEIVE the answer from server (data.json etc.)
  // Instead of storing plaintext answer → store HASH
  setAnswerHash(plaintextAnswer) {
    // Use a fast hash (you can use SHA-256 via subtle crypto if async ok)
    this.answerHash = this.simpleHash(plaintextAnswer.toLowerCase().trim());
  }

  simpleHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    }
    return (h >>> 0).toString(36);
  }

  // When user submits guess – compare hash instead of plaintext
  checkGuess(userGuess) {
    if (this.isBanned() || this.detectionScore >= 8) {
      this.banUser();
      return false;
    }

    const guessHash = this.simpleHash(userGuess.toLowerCase().trim());
    return guessHash === this.answerHash;
  }

  // ──────────────────────────────────────────────
  //                     Ban system
  // ──────────────────────────────────────────────

  checkBanStatus() {
    const banData = localStorage.getItem(`ban_${this.fingerprint}`);
    if (banData) {
      try {
        const { until } = JSON.parse(banData);
        this.bannedUntil = new Date(until);
      } catch {
        localStorage.removeItem(`ban_${this.fingerprint}`);
      }
    }

    // Also check suspicion cookie from previous session
    if (localStorage.getItem(`antiCheatSusp_${this.fingerprint}`)) {
      this.detectionScore = 10; // restore suspicion
      this.onDevToolsDetected();
    }
  }

  isBanned() {
    if (!this.bannedUntil) return false;
    if (new Date() < this.bannedUntil) return true;

    this.clearBan();
    return false;
  }

  banUser() {
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const data = { until: until.toISOString() };
    localStorage.setItem(`ban_${this.fingerprint}`, JSON.stringify(data));
    this.bannedUntil = until;
    this.showBanScreen();
  }

  clearBan() {
    localStorage.removeItem(`ban_${this.fingerprint}`);
    this.bannedUntil = null;
  }

  showBanScreen() {
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;background:#111;color:#f33;display:flex;align-items:center;justify-content:center;font-family:sans-serif;z-index:2147483647;">
        <div style="text-align:center;padding:3rem;background:#222;border-radius:1rem;max-width:480px;">
          <h1 style="font-size:4rem;margin:0;">BANNED</h1>
          <p style="font-size:1.4rem;color:#aaa;">Cheating detected (DevTools / tampering)</p>
          <p style="font-size:1.1rem;color:#e74c3c;">Ban expires: ${this.bannedUntil?.toLocaleString() || 'never'}</p>
          <p style="margin-top:2rem;color:#777;">Play fair or wait it out.</p>
        </div>
      </div>
    `;
    document.body.style.overflow = 'hidden';
  }

  destroy() {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }
}

// Global instance
const antiCheat = new AntiCheat();
window.antiCheat = antiCheat; // only for debugging – remove in production

// ──────────────────────────────────────────────
//           USAGE EXAMPLE (in your game code)
// ──────────────────────────────────────────────

// When you fetch the daily answer (e.g. from data.json)
fetch('/data.json')
  .then(r => r.json())
  .then(data => {
    antiCheat.setAnswerHash(data.answer);   // store HASH only
  });

// When user submits guess
function handleGuess(guess) {
  if (!antiCheat.checkOnGuess()) return;   // you need to add this method if you want extra checks

  if (antiCheat.checkGuess(guess)) {
    // win – send to server for validation anyway if multiplayer/ranking
    alert('Correct!');
  } else {
    // wrong
  }
}
