class AntiCheat {
  constructor() {
    this.devToolsDetected = false;
    this.bannedUntil = null;
    this.fingerprint = this.generateFingerprint();
    this.checkInterval = null;
    this.aggressiveActive = false;
    this.sensitiveDataProxied = false;

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
    this.preventCommonCheatTools();
    this.hideSensitiveGlobals();
  }

  generateFingerprint() {
    const data = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      !!window.chrome,
      navigator.hardwareConcurrency || 0
    ].join('|');
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  blockContextMenu() {
    document.addEventListener('contextmenu', e => e.preventDefault(), { capture: true });
  }

  blockDevToolsShortcuts() {
    document.addEventListener('keydown', e => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && e.key === 'u' || e.key === 'U')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.devToolsDetected = true;
        this.activateAggressiveMeasures();
      }
    }, { capture: true });
  }

  startDevToolsDetection() {
    this.detectViaSize();
    this.detectViaConsoleTrick();
    this.detectViaTiming();

    window.addEventListener('resize', () => this.detectViaSize());
    this.checkInterval = setInterval(() => {
      this.detectViaSize();
      this.detectViaTiming();
    }, 800);
  }

  detectViaSize() {
    const deltaOuterInnerW = window.outerWidth - window.innerWidth;
    const deltaOuterInnerH = window.outerHeight - window.innerHeight;
    if (
      (deltaOuterInnerW > 150 && deltaOuterInnerH > 150) ||
      (deltaOuterInnerW > 300 || deltaOuterInnerH > 300)
    ) {
      this.devToolsDetected = true;
      this.activateAggressiveMeasures();
    }
  }

  detectViaConsoleTrick() {
    const testObj = {};
    let triggerCount = 0;

    Object.defineProperty(testObj, 'prop', {
      get: () => {
        triggerCount++;
        if (triggerCount >= 3) {
          this.devToolsDetected = true;
          this.activateAggressiveMeasures();
        }
        return 42;
      }
    });

    setInterval(() => {
      console.log(testObj.prop);
      console.clear();
    }, 1200);
  }

  detectViaTiming() {
    const start = performance.now();
    debugger;
    const end = performance.now();

    if (end - start > 40) {
      this.devToolsDetected = true;
      this.activateAggressiveMeasures();
    }
  }

  activateAggressiveMeasures() {
    if (this.aggressiveActive) return;
    this.aggressiveActive = true;

    this.startHeavyConsoleSpam();
    this.protectConsoleMethods();
    this.scrambleDOM();
    this.banOnNextInteraction();
  }

  startHeavyConsoleSpam() {
    setInterval(() => {
      for (let i = 0; i < 80; i++) {
        console.log('%cANTI-CHEAT TRIGGERED — CHEATING DETECTED', 'color:#f00;font-size:22px;font-weight:bold;background:#000;padding:6px');
      }
      console.clear();
    }, 80);

    setInterval(() => { debugger; }, 300);
  }

  protectConsoleMethods() {
    const methods = ['log','info','warn','error','debug','table','dir','dirxml','trace'];
    methods.forEach(m => {
      const orig = console[m];
      console[m] = (...args) => {
        for (let i = 0; i < 30; i++) {
          orig.call(console, '%cCHEAT DETECTED — CLOSE DEVTOOLS', 'color:red;font-size:18px');
        }
        console.clear();
        return orig.apply(console, args);
      };
    });

    const origEval = window.eval;
    window.eval = code => {
      console.warn('eval blocked by anti-cheat');
      return null;
    };

    const origFunc = window.Function;
    window.Function = function(...args) {
      console.warn('Function constructor blocked by anti-cheat');
      return function() { return null; };
    };
  }

  scrambleDOM() {
    setInterval(() => {
      document.querySelectorAll('*').forEach(el => {
        el.className += ` x-${Math.random().toString(36).slice(2)}`;
      });
    }, 600);
  }

  hideSensitiveGlobals() {
    if (this.sensitiveDataProxied) return;
    this.sensitiveDataProxied = true;

    const sensitiveNames = ['answer', 'solution', 'correctAnswer', 'gameAnswer', 'currentAnswer', 'flag'];

    sensitiveNames.forEach(name => {
      let realValue = window[name];
      delete window[name];

      Object.defineProperty(window, name, {
        get: () => {
          this.devToolsDetected = true;
          this.activateAggressiveMeasures();
          return 'CHEAT_DETECTED';
        },
        set: () => {},
        configurable: false
      });

      if (realValue !== undefined) {
        window[`_${name}_hidden`] = realValue;
      }
    });

    const originalJSON = JSON.stringify;
    JSON.stringify = (obj, ...args) => {
      if (obj && typeof obj === 'object') {
        sensitiveNames.forEach(name => {
          if (obj[name]) obj[name] = 'REDACTED_BY_ANTICHEAT';
        });
      }
      return originalJSON.call(JSON, obj, ...args);
    };
  }

  banOnNextInteraction() {
    const banHandler = () => {
      this.banUser();
      document.removeEventListener('click', banHandler);
      document.removeEventListener('keydown', banHandler);
    };
    document.addEventListener('click', banHandler, { once: true, capture: true });
    document.addEventListener('keydown', banHandler, { once: true, capture: true });
  }

  checkBanStatus() {
    let banData = this.getCookie('beatdle_ban') || localStorage.getItem('beatdle_ban_' + this.fingerprint);

    if (banData) {
      try {
        const data = JSON.parse(atob(banData));
        this.bannedUntil = new Date(data.until);
      } catch {
        this.clearBan();
      }
    }
  }

  isBanned() {
    if (!this.bannedUntil) return false;
    const now = new Date();
    if (now < this.bannedUntil) return true;

    this.clearBan();
    return false;
  }

  banUser() {
    const banUntil = new Date();
    banUntil.setDate(banUntil.getDate() + 7);

    const banData = {
      until: banUntil.toISOString(),
      reason: 'devtools_usage',
      fp: this.fingerprint
    };

    const encoded = btoa(JSON.stringify(banData));

    this.setCookie('beatdle_ban', encoded, 7);
    localStorage.setItem('beatdle_ban_' + this.fingerprint, encoded);

    this.bannedUntil = banUntil;
    this.showBanScreen();
  }

  clearBan() {
    this.deleteCookie('beatdle_ban');
    localStorage.removeItem('beatdle_ban_' + this.fingerprint);
    this.bannedUntil = null;
  }

  showBanScreen() {
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;z-index:999999;font-family:system-ui;">
        <div style="background:white;padding:50px;border-radius:24px;box-shadow:0 25px 70px rgba(0,0,0,0.4);text-align:center;max-width:520px;">
          <div style="font-size:80px;margin-bottom:24px;">⛔</div>
          <h1 style="color:#c0392b;margin:0 0 24px;font-size:36px;">Cheating Detected</h1>
          <p style="color:#444;font-size:19px;margin-bottom:24px;">
            Developer Tools usage was detected during gameplay.
          </p>
          <p style="color:#222;font-size:17px;font-weight:bold;margin-bottom:32px;">
            7-day ban active — expires ${this.bannedUntil ? this.bannedUntil.toLocaleString() : '???'}
          </p>
          <p style="color:#777;font-size:15px;">
            Play fair. See you soon.
          </p>
        </div>
      </div>
    `;
    document.body.style.overflow = 'hidden';
  }

  setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Strict;Secure`;
  }

  getCookie(name) {
    const prefix = name + "=";
    for (const c of document.cookie.split(';')) {
      let trimmed = c.trim();
      if (trimmed.startsWith(prefix)) return trimmed.substring(prefix.length);
    }
    return null;
  }

  deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }

  preventCommonCheatTools() {
    setInterval(() => {
      if (window.console && console.clear && console.log.length === 0) {
        this.devToolsDetected = true;
      }
    }, 2000);
  }

  destroy() {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }
}

window.antiCheat = new AntiCheat();
