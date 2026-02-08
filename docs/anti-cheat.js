// Anti-Cheat Protection System
// Detects DevTools usage and bans cheaters

class AntiCheat {
  constructor() {
    this.devToolsOpen = false;
    this.devToolsDetected = false;
    this.bannedUntil = null;
    this.checkInterval = null;
    this.encryptionKey = this.generateKey();
    this.executionPaused = false;
    this.aggressiveActive = false;
    this.debuggerSpamIntervals = [];
    
    // Protected storage for game data
    this._protectedData = new Map();
    
    this.init();
  }
  
  init() {
    // Check if already banned
    this.checkBanStatus();
    
    if (this.isBanned()) {
      this.showBanScreen();
      return;
    }
    
    // FIRST - Protect global scope immediately
    this.protectGlobalScope();
    
    // Block context menu immediately
    this.blockContextMenu();
    
    // Start monitoring for DevTools (lightweight detection)
    this.startDevToolsDetection();
    
    // Monitor for common cheating attempts
    this.preventDebugger();
    
    // Protect window and document objects
    this.lockDownDOM();
  }
  
  // CRITICAL: Protect global scope from console access
  protectGlobalScope() {
    // Freeze Object prototype to prevent prototype pollution
    Object.freeze(Object.prototype);
    
    // Override window property access
    const originalDefineProperty = Object.defineProperty;
    
    // List of protected variable names that should be hidden
    const protectedNames = ['answer', 'correctAnswer', 'solution', 'gameData', 'songData', 'trackData'];
    
    // Intercept all property definitions on window
    Object.defineProperty = function(obj, prop, descriptor) {
      // Block access to protected properties
      if (obj === window && protectedNames.some(name => prop.toLowerCase().includes(name.toLowerCase()))) {
        console.error('🚫 ANTI-CHEAT: Access denied');
        return obj;
      }
      return originalDefineProperty.call(this, obj, prop, descriptor);
    };
    
    // Override console to block answer access
    this.protectConsoleFromStart();
  }
  
  // Protect console BEFORE DevTools detection
  protectConsoleFromStart() {
    const self = this;
    const protectedNames = ['answer', 'correctAnswer', 'solution', 'gameData', 'songData', 'trackData'];
    
    // Store original console methods
    const originalLog = console.log;
    const originalDir = console.dir;
    const originalTable = console.table;
    
    // Override console.log to filter protected data
    console.log = function(...args) {
      // Check if any arg is trying to access protected data
      const filtered = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          // Check if object has protected properties
          for (let key in arg) {
            if (protectedNames.some(name => key.toLowerCase().includes(name.toLowerCase()))) {
              return '🚫 [PROTECTED DATA]';
            }
          }
        }
        if (typeof arg === 'string' && protectedNames.some(name => arg.toLowerCase().includes(name.toLowerCase()))) {
          return '🚫 [PROTECTED DATA]';
        }
        return arg;
      });
      return originalLog.apply(console, filtered);
    };
    
    // Override console.dir
    console.dir = function(obj) {
      if (typeof obj === 'object' && obj !== null) {
        for (let key in obj) {
          if (protectedNames.some(name => key.toLowerCase().includes(name.toLowerCase()))) {
            console.log('🚫 ANTI-CHEAT: Cannot inspect protected data');
            return;
          }
        }
      }
      return originalDir.call(console, obj);
    };
    
    // Override console.table
    console.table = function(data) {
      console.log('🚫 ANTI-CHEAT: console.table disabled');
      return;
    };
  }
  
  // Lock down DOM to prevent inspection
  lockDownDOM() {
    // Prevent access to document.querySelector for protected elements
    const originalQuerySelector = document.querySelector;
    const originalQuerySelectorAll = document.querySelectorAll;
    
    document.querySelector = function(selector) {
      if (selector.includes('answer') || selector.includes('data-answer')) {
        console.error('🚫 ANTI-CHEAT: Blocked selector');
        return null;
      }
      return originalQuerySelector.call(document, selector);
    };
    
    document.querySelectorAll = function(selector) {
      if (selector.includes('answer') || selector.includes('data-answer')) {
        console.error('🚫 ANTI-CHEAT: Blocked selector');
        return [];
      }
      return originalQuerySelectorAll.call(document, selector);
    };
  }
  
  // Store protected data (use this instead of global variables)
  setProtectedData(key, value) {
    // Encrypt the value
    const encrypted = this.encrypt(JSON.stringify(value));
    this._protectedData.set(key, encrypted);
  }
  
  // Retrieve protected data
  getProtectedData(key) {
    const encrypted = this._protectedData.get(key);
    if (!encrypted) return null;
    
    try {
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (e) {
      return null;
    }
  }
  
  // Block right-click context menu
  blockContextMenu() {
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });
  }
  
  // Start aggressive measures ONLY when DevTools detected
  activateAggressiveMeasures() {
    if (this.aggressiveActive) return;
    this.aggressiveActive = true;
    
    console.log('DevTools detected - activating aggressive anti-cheat');
    
    this.startConsoleSpam();
    this.protectConsoleAggressive();
    this.scrambleDOM();
    this.pauseExecution();
    this.spamDebugger();
  }
  
  // Spam debugger statements to freeze DevTools
  spamDebugger() {
    // Create multiple aggressive debugger intervals
    const createDebuggerSpam = () => {
      const interval = setInterval(() => {
        if (!this.aggressiveActive) {
          clearInterval(interval);
          return;
        }
        debugger;
      }, 1);
      this.debuggerSpamIntervals.push(interval);
    };
    
    // Create 10 parallel debugger spam intervals
    for (let i = 0; i < 10; i++) {
      createDebuggerSpam();
    }
    
    // Recursive immediate debugger
    const recursiveDebugger = () => {
      if (!this.aggressiveActive) return;
      debugger;
      debugger;
      debugger;
      Promise.resolve().then(recursiveDebugger);
    };
    recursiveDebugger();
    
    // Also use requestAnimationFrame for continuous spam
    const rafDebugger = () => {
      if (!this.aggressiveActive) return;
      debugger;
      requestAnimationFrame(rafDebugger);
    };
    rafDebugger();
  }
  
  // Aggressively spam console and clear it
  startConsoleSpam() {
    setInterval(() => {
      if (!this.aggressiveActive) return;
      
      for (let i = 0; i < 100; i++) {
        console.log('%c🚫 ANTI-CHEAT ACTIVE 🚫', 'color: red; font-size: 20px; font-weight: bold;');
      }
      console.clear();
    }, 50);
  }
  
  // Aggressive console protection when DevTools detected
  protectConsoleAggressive() {
    // Override ALL console methods
    const methods = ['log', 'dir', 'dirxml', 'table', 'trace', 'info', 'warn', 'error', 'debug', 'group', 'groupEnd', 'groupCollapsed'];
    
    methods.forEach(method => {
      console[method] = function() {
        debugger;
        for (let i = 0; i < 50; i++) {
          console.clear();
        }
        return undefined;
      };
    });
    
    // Block eval
    window.eval = new Proxy(window.eval, {
      apply: function() {
        debugger;
        console.error('🚫 ANTI-CHEAT: eval() BLOCKED');
        return null;
      }
    });
    
    // Block Function constructor
    window.Function = new Proxy(window.Function, {
      construct: function() {
        debugger;
        console.error('🚫 ANTI-CHEAT: Function() BLOCKED');
        return function() {};
      }
    });
    
    // Block setTimeout/setInterval with string code
    const originalSetTimeout = window.setTimeout;
    const originalSetInterval = window.setInterval;
    
    window.setTimeout = function(code, ...args) {
      if (typeof code === 'string') {
        debugger;
        return null;
      }
      return originalSetTimeout.call(window, code, ...args);
    };
    
    window.setInterval = function(code, ...args) {
      if (typeof code === 'string') {
        debugger;
        return null;
      }
      return originalSetInterval.call(window, code, ...args);
    };
  }
  
  // Scramble DOM when DevTools detected
  // Source - https://stackoverflow.com/a/65102393
  // Posted by Diego Fortes, modified by community
  // Retrieved 2026-02-07, License - CC BY-SA 4.0
  scrambleDOM() {
    setInterval(() => {
      if (!this.aggressiveActive) return;
      
      var $all = document.querySelectorAll("*");
      for (var each of $all) {
        each.classList.add(`x${Math.random().toString(36).substr(2, 9)}`);
      }
    }, 100);
  }
  
  // Generate encryption key from session
  generateKey() {
    const seed = Date.now().toString() + navigator.userAgent + Math.random();
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  // Simple encryption for answer
  encrypt(text) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return btoa(result);
  }
  
  decrypt(encrypted) {
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i);
      const keyChar = this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return result;
  }
  
  // Multiple methods to detect DevTools
  startDevToolsDetection() {
    // Method 1: Console detection via element inspection
    const element = new Image();
    let consoleOpenCount = 0;
    
    Object.defineProperty(element, 'id', {
      get: () => {
        consoleOpenCount++;
        if (consoleOpenCount > 2) {
          this.devToolsOpen = true;
          this.devToolsDetected = true;
          this.activateAggressiveMeasures();
        }
        return 'devtools-check';
      }
    });
    
    this.checkInterval = setInterval(() => {
      console.log('%c', element);
      console.clear();
    }, 1000);
    
    // Method 2: Window size detection
    this.checkWindowSize();
    window.addEventListener('resize', () => this.checkWindowSize());
    
    // Method 3: debugger timing detection
    this.checkDebuggerTiming();
    
    // Method 4: toString detection
    this.toStringDetection();
  }
  
  checkWindowSize() {
    const widthThreshold = window.outerWidth - window.innerWidth > 200;
    const heightThreshold = window.outerHeight - window.innerHeight > 200;
    
    if (widthThreshold && heightThreshold) {
      this.devToolsOpen = true;
      this.devToolsDetected = true;
      this.activateAggressiveMeasures();
    }
  }
  
  checkDebuggerTiming() {
    setInterval(() => {
      const start = performance.now();
      // This debugger only runs during detection, not spam
      if (!this.aggressiveActive) {
        debugger;
      }
      const end = performance.now();
      
      if (end - start > 100) {
        this.devToolsOpen = true;
        this.devToolsDetected = true;
        this.activateAggressiveMeasures();
      }
    }, 2000);
  }
  
  toStringDetection() {
    const div = document.createElement('div');
    Object.defineProperty(div, 'id', {
      get: () => {
        this.devToolsOpen = true;
        this.devToolsDetected = true;
        this.activateAggressiveMeasures();
        return 'detection';
      }
    });
    
    setInterval(() => {
      console.log(div);
      console.clear();
    }, 1000);
  }
  
  pauseExecution() {
    if (this.executionPaused) return;
    this.executionPaused = true;
    
    console.log('%c🚫 DevTools detected - you will be banned if you submit a guess 🚫', 
                'color: red; font-size: 24px; font-weight: bold;');
  }
  
  preventDebugger() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12' ||
          e.keyCode === 123 ||
          (e.ctrlKey && e.shiftKey && e.keyCode === 73) ||
          (e.ctrlKey && e.shiftKey && e.keyCode === 74) ||
          (e.ctrlKey && e.shiftKey && e.keyCode === 67) ||
          (e.ctrlKey && e.keyCode === 85)) {
        e.preventDefault();
        e.stopPropagation();
        this.devToolsDetected = true;
        this.activateAggressiveMeasures();
        return false;
      }
    });
  }
  
  checkBanStatus() {
    const banData = this.getCookie('beatdle_ban');
    if (banData) {
      try {
        const data = JSON.parse(atob(banData));
        this.bannedUntil = new Date(data.until);
      } catch (e) {
        this.deleteCookie('beatdle_ban');
      }
    }
  }
  
  isBanned() {
    if (!this.bannedUntil) return false;
    
    const now = new Date();
    if (now < this.bannedUntil) {
      return true;
    } else {
      this.deleteCookie('beatdle_ban');
      this.bannedUntil = null;
      return false;
    }
  }
  
  banUser() {
    const banUntil = new Date();
    banUntil.setDate(banUntil.getDate() + 7);
    
    const banData = {
      until: banUntil.toISOString(),
      reason: 'cheating_detected'
    };
    
    this.setCookie('beatdle_ban', btoa(JSON.stringify(banData)), 7);
    this.bannedUntil = banUntil;
    this.showBanScreen();
  }
  
  showBanScreen() {
    document.body.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          text-align: center;
          max-width: 500px;
        ">
          <div style="font-size: 72px; margin-bottom: 20px;">🚫</div>
          <h1 style="color: #e74c3c; margin: 0 0 20px 0; font-size: 32px;">lolz you cheated</h1>
          <p style="color: #555; font-size: 18px; margin-bottom: 20px;">
            We detected that you opened DevTools/Inspector while playing.
          </p>
          <p style="color: #333; font-size: 16px; margin-bottom: 30px;">
            <strong>You are banned from Beatdle for 7 days.</strong>
          </p>
          <p style="color: #777; font-size: 14px;">
            Ban expires: ${this.bannedUntil ? this.bannedUntil.toLocaleString() : 'Unknown'}
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Play fair next time! 🎵
          </p>
        </div>
      </div>
    `;
    
    document.body.style.overflow = 'hidden';
  }
  
  checkOnGuess() {
    if (this.devToolsDetected) {
      this.banUser();
      return false;
    }
    return true;
  }
  
  setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  }
  
  getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }
  
  deleteCookie(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }
  
  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.debuggerSpamIntervals.forEach(interval => clearInterval(interval));
    this.aggressiveActive = false;
  }
}

// Initialize anti-cheat globally
window.antiCheat = new AntiCheat();

// IMPORTANT: Usage example to protect your answer variable
// Instead of: let answer = "Song Name";
// Use: window.antiCheat.setProtectedData('answer', "Song Name");
// To retrieve: window.antiCheat.getProtectedData('answer');
