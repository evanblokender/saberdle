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
    this.aggressiveActive = false; // Only activate when DevTools detected
    this.debuggerSpamInterval = null;
    
    this.init();
  }
  
  init() {
    // Check if already banned
    this.checkBanStatus();
    
    if (this.isBanned()) {
      this.showBanScreen();
      return;
    }
    
    // Block context menu immediately
    this.blockContextMenu();
    
    // Start monitoring for DevTools (lightweight detection)
    this.startDevToolsDetection();
    
    // Monitor for common cheating attempts
    this.preventDebugger();
    
    // DON'T start aggressive measures until DevTools detected
    // This prevents lag for normal users
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
    if (this.aggressiveActive) return; // Already active
    this.aggressiveActive = true;
    
    console.log('DevTools detected - activating aggressive anti-cheat');
    
    // Now start the spam and scrambling
    this.startConsoleSpam();
    this.protectConsole();
    this.scrambleDOM();
    this.pauseExecution();
    this.spamDebugger(); // NEW: Aggressive debugger spam
  }
  
  // NEW: Spam debugger statements to freeze DevTools
  spamDebugger() {
    // Clear any existing interval
    if (this.debuggerSpamInterval) {
      clearInterval(this.debuggerSpamInterval);
    }
    
    // Spam debugger statements every 1ms when DevTools is open
    // This will keep pausing execution and jumping to this line
    this.debuggerSpamInterval = setInterval(() => {
      debugger; // This line will be hit constantly
      debugger; // Multiple debuggers for extra annoyance
      debugger;
      debugger;
      debugger;
    }, 1);
    
    // Also create immediate recursive debugger spam
    const recursiveDebugger = () => {
      if (this.aggressiveActive) {
        debugger;
        setTimeout(recursiveDebugger, 0);
      }
    };
    recursiveDebugger();
    
    // Create multiple parallel debugger loops
    for (let i = 0; i < 5; i++) {
      setInterval(() => {
        if (this.aggressiveActive) {
          debugger;
        }
      }, 1);
    }
  }
  
  // Aggressively spam console and clear it
  startConsoleSpam() {
    // Reduced from 1ms to 100ms to reduce lag
    setInterval(() => {
      for (let i = 0; i < 50; i++) {
        console.log('%c🚫 ANTI-CHEAT ACTIVE 🚫', 'color: red; font-size: 20px; font-weight: bold;');
      }
      console.clear();
    }, 100);
    
    // Override window eval to prevent code execution
    window.eval = function() {
      console.log('%c🚫 ANTI-CHEAT: eval() BLOCKED 🚫', 'color: red; font-size: 20px; font-weight: bold;');
      debugger; // Freeze on eval attempt
      return null;
    };
    
    // Override Function constructor
    window.Function = function() {
      console.log('%c🚫 ANTI-CHEAT: Function() BLOCKED 🚫', 'color: red; font-size: 20px; font-weight: bold;');
      debugger; // Freeze on Function attempt
      return function() {};
    };
  }
  
  // Scramble DOM when DevTools detected
  // Source - https://stackoverflow.com/a/65102393
  // Posted by Diego Fortes, modified by community
  // Retrieved 2026-02-07, License - CC BY-SA 4.0
  scrambleDOM() {
    // Reduced from 5ms to 500ms to reduce lag
    setInterval(() => {
      var $all = document.querySelectorAll("*");
      for (var each of $all) {
        each.classList.add(`asdjaljsdliasud8ausdijaisdluasdjasildahjdsk${Math.random()}`);
      }
    }, 500);
  }
  
  // Generate encryption key from session
  generateKey() {
    const seed = Date.now().toString() + navigator.userAgent;
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
    return btoa(result); // Base64 encode
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
  
  // Encrypt JSON data for network protection
  encryptJSON(obj) {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString);
  }
  
  // Decrypt JSON data
  decryptJSON(encrypted) {
    const jsonString = this.decrypt(encrypted);
    return JSON.parse(jsonString);
  }
  
  // Multiple methods to detect DevTools
  startDevToolsDetection() {
    // Method 1: Console detection via element inspection
    // This only triggers when console is ACTUALLY open and inspecting objects
    const element = new Image();
    let consoleOpenCount = 0;
    
    Object.defineProperty(element, 'id', {
      get: () => {
        consoleOpenCount++;
        // Only mark as detected after multiple triggers to avoid false positives
        if (consoleOpenCount > 2) {
          this.devToolsOpen = true;
          this.devToolsDetected = true;
          this.activateAggressiveMeasures(); // Activate spam/scramble/freeze
        }
        return 'devtools-check';
      }
    });
    
    // Trigger the getter periodically (lightweight check)
    this.checkInterval = setInterval(() => {
      console.log('%c', element);
      console.clear();
    }, 1000);
    
    // Method 2: Window size detection (more conservative thresholds)
    this.checkWindowSize();
    window.addEventListener('resize', () => this.checkWindowSize());
    
    // Method 3: Performance timing detection
    this.checkPerformanceTiming();
  }
  
  checkWindowSize() {
    // More conservative thresholds to avoid false positives
    const widthThreshold = window.outerWidth - window.innerWidth > 200;
    const heightThreshold = window.outerHeight - window.innerHeight > 200;
    
    // Only flag if BOTH conditions are suspicious
    if (widthThreshold && heightThreshold) {
      this.devToolsOpen = true;
      this.devToolsDetected = true;
      this.activateAggressiveMeasures(); // Activate spam/scramble/freeze
    }
  }
  
  // Check if debugger pauses execution (DevTools must be open)
  checkPerformanceTiming() {
    setInterval(() => {
      const start = performance.now();
      debugger; // This will only pause if DevTools is open
      const end = performance.now();
      
      // If this took more than 100ms, DevTools is open and paused execution
      if (end - start > 100) {
        this.devToolsOpen = true;
        this.devToolsDetected = true;
        this.activateAggressiveMeasures();
      }
    }, 1000);
  }
  
  // Pause execution to prevent data.json fetching
  pauseExecution() {
    if (this.executionPaused) return; // Already paused
    this.executionPaused = true;
    
    // Start DOM scrambling
    this.scrambleDOM();
    
    console.log('%c🚫 DevTools detected - you will be banned if you submit a guess 🚫', 
                'color: red; font-size: 24px; font-weight: bold;');
  }
  
  // Protect console from being used (only when DevTools detected)
  protectConsole() {
    // Override all console methods to spam anti-cheat messages
    const methods = ['log', 'dir', 'dirxml', 'table', 'trace', 'info', 'warn', 'error', 'debug'];
    
    methods.forEach(method => {
      const original = console[method];
      console[method] = (...args) => {
        // Spam anti-cheat messages (reduced amount)
        for (let i = 0; i < 20; i++) {
          original.call(console, '%c🚫 ANTI-CHEAT ACTIVE 🚫', 'color: red; font-size: 20px; font-weight: bold;');
        }
        console.clear();
        
        // Trigger debugger on console use
        debugger;
        
        return original.apply(console, args);
      };
    });
  }
  
  preventDebugger() {
    // Detect F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U
    document.addEventListener('keydown', (e) => {
      // F12
      if (e.key === 'F12' ||
          e.keyCode === 123 ||
          // Ctrl+Shift+I (Inspect)
          (e.ctrlKey && e.shiftKey && e.keyCode === 73) ||
          // Ctrl+Shift+J (Console)
          (e.ctrlKey && e.shiftKey && e.keyCode === 74) ||
          // Ctrl+Shift+C (Inspect element)
          (e.ctrlKey && e.shiftKey && e.keyCode === 67) ||
          // Ctrl+U (View source)
          (e.ctrlKey && e.keyCode === 85)) {
        e.preventDefault();
        e.stopPropagation();
        this.devToolsDetected = true;
        this.activateAggressiveMeasures();
        return false;
      }
    });
  }
  
  // Check if user is banned
  checkBanStatus() {
    const banData = this.getCookie('beatdle_ban');
    if (banData) {
      try {
        const data = JSON.parse(atob(banData));
        this.bannedUntil = new Date(data.until);
      } catch (e) {
        // Invalid ban cookie, remove it
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
      // Ban expired
      this.deleteCookie('beatdle_ban');
      this.bannedUntil = null;
      return false;
    }
  }
  
  // Ban the user (7 days)
  banUser() {
    const banUntil = new Date();
    banUntil.setDate(banUntil.getDate() + 7); // 7 day ban
    
    const banData = {
      until: banUntil.toISOString(),
      reason: 'cheating_detected'
    };
    
    this.setCookie('beatdle_ban', btoa(JSON.stringify(banData)), 7);
    this.bannedUntil = banUntil;
    this.showBanScreen();
  }
  
  // Show ban screen
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
    
    // Prevent any interaction
    document.body.style.overflow = 'hidden';
  }
  
  // Check on guess submission
  checkOnGuess() {
    if (this.devToolsDetected) {
      this.banUser();
      return false; // Block the guess
    }
    return true; // Allow the guess
  }
  
  // Cookie helpers
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
  
  // Clean up
  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    if (this.debuggerSpamInterval) {
      clearInterval(this.debuggerSpamInterval);
    }
    this.aggressiveActive = false;
  }
}

// Initialize anti-cheat globally
window.antiCheat = new AntiCheat();
