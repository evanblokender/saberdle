// Anti-Cheat Protection System
// Detects DevTools usage and bans cheaters

class AntiCheat {
  constructor() {
    this.devToolsOpen = false;
    this.devToolsDetected = false;
    this.bannedUntil = null;
    this.checkInterval = null;
    this.encryptionKey = this.generateKey();
    
    this.init();
  }
  
  init() {
    // Check if already banned
    this.checkBanStatus();
    
    if (this.isBanned()) {
      this.showBanScreen();
      return;
    }
    
    // Start monitoring for DevTools
    this.startDevToolsDetection();
    
    // Monitor for common cheating attempts
    this.protectConsole();
    this.preventDebugger();
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
        }
        return 'devtools-check';
      }
    });
    
    // Trigger the getter periodically
    this.checkInterval = setInterval(() => {
      console.log('%c', element);
      console.clear();
    }, 1000);
    
    // Method 2: Window size detection (more conservative thresholds)
    this.checkWindowSize();
    window.addEventListener('resize', () => this.checkWindowSize());
    
    // Method 3: Firebug check (older method but reliable)
    this.checkFirebug();
  }
  
  checkWindowSize() {
    // More conservative thresholds to avoid false positives
    const widthThreshold = window.outerWidth - window.innerWidth > 200;
    const heightThreshold = window.outerHeight - window.innerHeight > 200;
    
    // Only flag if BOTH conditions are suspicious
    if (widthThreshold && heightThreshold) {
      this.devToolsOpen = true;
      this.devToolsDetected = true;
    }
  }
  
  checkFirebug() {
    // Check for Firebug (old but works for some browsers)
    setInterval(() => {
      if (window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) {
        this.devToolsOpen = true;
        this.devToolsDetected = true;
      }
    }, 500);
  }
  
  // Protect console from being used
  protectConsole() {
    // We rely on the element.id getter trick instead of overriding console methods
    // This prevents false positives from normal console usage in the page
  }
  
  preventDebugger() {
    // Detect F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    document.addEventListener('keydown', (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        this.devToolsDetected = true;
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
  }
}

// Initialize anti-cheat globally
window.antiCheat = new AntiCheat();
