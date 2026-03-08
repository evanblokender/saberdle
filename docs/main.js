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
    this._protectedData = new Map();
    this.init();
  }
  init() {
    this.checkBanStatus();
    if (this.isBanned()) {
      this.showBanScreen();
      return;
    }
    this.protectGlobalScope();
    this.blockContextMenu();
    this.startDevToolsDetection();
    this.preventDebugger();
    this.lockDownDOM();
  }
  protectGlobalScope() {
    Object.freeze(Object.prototype);
    const originalDefineProperty = Object.defineProperty;
    const protectedNames = ['answer', 'correctAnswer', 'solution', 'gameData', 'songData', 'trackData'];
    Object.defineProperty = function(obj, prop, descriptor) {
      if (obj === window && protectedNames.some(name => prop.toLowerCase().includes(name.toLowerCase()))) {
        console.error('🚫 ANTI-CHEAT: Access denied');
        return obj;
      }
      return originalDefineProperty.call(this, obj, prop, descriptor);
    };
    this.protectConsoleFromStart();
  }
  protectConsoleFromStart() {
    const self = this;
    const protectedNames = ['answer', 'correctAnswer', 'solution', 'gameData', 'songData', 'trackData'];
    const originalLog = console.log;
    const originalDir = console.dir;
    const originalTable = console.table;
    console.log = function(...args) {
      const filtered = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
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
    console.table = function(data) {
      console.log('🚫 ANTI-CHEAT: console.table disabled');
      return;
    };
  }
  lockDownDOM() {
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
  setProtectedData(key, value) {
    const encrypted = this.encrypt(JSON.stringify(value));
    this._protectedData.set(key, encrypted);
  }
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
  blockContextMenu() {
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });
  }
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
  spamDebugger() {}
  startConsoleSpam() {}
  protectConsoleAggressive() {}
  scrambleDOM() {
    setInterval(() => {
      if (!this.aggressiveActive) return;
      var $all = document.querySelectorAll("*");
      for (var each of $all) {
        each.classList.add(`x${Math.random().toString(36).substr(2, 9)}`);
      }
    }, 100);
  }
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
  startDevToolsDetection() {
    this.checkWindowSize();
    window.addEventListener('resize', () => this.checkWindowSize());
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
  checkDebuggerTiming() {}
  toStringDetection() {}
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
window.antiCheat = new AntiCheat();

let previewTime = 3;
let attempts = 0;
const maxAttempts = 6;
let isPlaying = false;
let previewInterval = null;
let answer = ""; 
let answerDisplay = "";
let dailyDate = "";
let gameOver = false;
let gameMode = "daily"; 
let infiniteScore = 0;
let infiniteSongs = [];
let currentInfiniteSong = null;

let encryptedAnswer = "";
let actualAnswer = ""; 

const APP_VERSION = "6.0.4";

const audio = document.getElementById("audio");
const playBtn = document.getElementById("play-btn");
const skipBtn = document.getElementById("skip-btn");
const progressBar = document.getElementById("progress-bar");
const currentTimeEl = document.getElementById("current-time");
const totalTimeEl = document.getElementById("total-time");
const guessInput = document.getElementById("guess-input");
const autocompleteResults = document.getElementById("autocomplete-results");
const guessesContainer = document.getElementById("guesses-container");
const gameOverDiv = document.getElementById("game-over");
const resultMessage = document.getElementById("result-message");
const shareBtn = document.getElementById("share-btn");
const countdownEl = document.getElementById("countdown");
const attemptsCount = document.getElementById("attempts-count");
const previewTimeDisplay = document.getElementById("preview-time");
const visualizer = document.querySelector(".visualizer");
const modeBtn = document.getElementById("mode-btn");
const resetBtn = document.getElementById("reset-btn");
const infiniteScoreEl = document.getElementById("infinite-score");

const helpBtn = document.getElementById("help-btn");
const statsBtn = document.getElementById("stats-btn");
const themeBtn = document.getElementById("theme-btn");
const helpModal = document.getElementById("help-modal");
const statsModal = document.getElementById("stats-modal");
const modeModal = document.getElementById("mode-modal");
const toast = document.getElementById("toast");

function lockGameControls() {
  if (playBtn)    playBtn.disabled    = true;
  if (skipBtn)    skipBtn.disabled    = true;
  if (guessInput) guessInput.disabled = true;
}

function unlockGameControls() {
  if (!gameOver) {
    if (playBtn)    playBtn.disabled    = false;
    if (skipBtn)    skipBtn.disabled    = false;
    if (guessInput) guessInput.disabled = false;
  }
}

lockGameControls();

async function init() {
  checkVersion();
  loadTheme();
  loadGameMode();
  setupEventListeners();
  updateCountdown();
  setInterval(updateCountdown, 1000);

  window.setLoadingProgress?.(5, 'Starting up...');

  if (window.leaderboardAPI) {
    try {
      await window.leaderboardAPI.init();
    } catch (err) {
      console.error('[Beatdle] Session init failed, game locked:', err);
      return; 
    }
  } else {
    window.hideLoadingScreen?.();
  }

  window.setLoadingProgress?.(80, 'Loading song...');

  if (gameMode === "daily") {
    await loadDaily();
  } else {
    await loadInfiniteMode();
  }

  unlockGameControls();
}

document.addEventListener("DOMContentLoaded", () => {
  init();
});

function checkVersion() {
  const savedVersion = localStorage.getItem("beatdle-version");
  if (savedVersion !== APP_VERSION) {
    console.log("New version detected, migrating data");
    
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith("beatdle-2") && !key.includes("stats")) {
        const state = localStorage.getItem(key);
        try {
          const parsed = JSON.parse(state);
          if (parsed && parsed.guesses && !parsed.migrated) {
            console.log(`Clearing old format state: ${key}`);
            localStorage.removeItem(key);
          }
        } catch (e) {
          localStorage.removeItem(key);
        }
      }
    }
    
    localStorage.setItem("beatdle-version", APP_VERSION);
    showToast("App updated! Old game states cleared.");
  }
}

function migrateOldGameStates() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("beatdle-") && key !== "beatdle-stats" && 
        key !== "beatdle-theme" && key !== "beatdle-mode" && 
        key !== "beatdle-version" && key !== "beatdle-infinite-score") {
      try {
        const state = JSON.parse(localStorage.getItem(key));
        if (state && state.guesses) {
          if (!state.migrated) {
            state.migrated = true;
            localStorage.setItem(key, JSON.stringify(state));
            console.log(`Migrated game state: ${key}`);
          }
        }
      } catch (e) {
        console.log(`Error migrating state ${key}:`, e);
      }
    }
  }
}

function loadGameMode() {
  const savedMode = localStorage.getItem("beatdle-mode");
  if (savedMode) {
    gameMode = savedMode;
  }
  updateModeDisplay();
}

function saveGameMode() {
  localStorage.setItem("beatdle-mode", gameMode);
}

function updateModeDisplay() {
  const modeIndicator = document.getElementById("mode-indicator");
  const countdownParent = document.getElementById("countdown")?.parentElement;
  const infiniteScoreContainer = document.getElementById("infinite-score-container");
  
  if (modeIndicator) {
    modeIndicator.textContent = gameMode === "daily" ? "Daily Mode" : "Infinite Mode";
  }
  
  if (gameMode === "infinite") {
    if (countdownParent) countdownParent.style.display = "none";
    if (infiniteScoreContainer) infiniteScoreContainer.style.display = "block";
    updateInfiniteScoreDisplay();
  } else {
    if (countdownParent) countdownParent.style.display = "block";
    if (infiniteScoreContainer) infiniteScoreContainer.style.display = "none";
  }
}

async function switchMode(newMode) {
  console.log(`Switching from ${gameMode} to ${newMode}`);
  
  if (gameMode === newMode) {
    console.log("Already in this mode, ignoring");
    return;
  }
  
  try {
    gameMode = newMode;
    saveGameMode();
    
    lockGameControls();
    
    console.log("Resetting game...");
    resetGame();
    
    const skipRestore = true;
    
    console.log(`Loading ${gameMode} mode...`);
    if (gameMode === "daily") {
      await loadDaily(skipRestore);
    } else {
      await loadInfiniteMode();
    }
    
    console.log("Updating mode display...");
    updateModeDisplay();
    
    console.log("Closing modal...");
    if (modeModal) {
      closeModal(modeModal);
    }
    
    unlockGameControls();
    showToast(`Switched to ${gameMode === "daily" ? "Daily" : "Infinite"} Mode`);
    console.log("Mode switch complete!");
  } catch (error) {
    console.error("Error switching modes:", error);
    showToast("Error switching modes. Please refresh the page.");
    unlockGameControls();
  }
}

async function loadInfiniteMode() {
  try {
    const randomPage = Math.floor(Math.random() * 100);
    
    const sortOrders = ['Relevance', 'Rating', 'Latest'];
    const randomSort = sortOrders[Math.floor(Math.random() * sortOrders.length)];
    
    console.log(`Loading infinite mode: page ${randomPage}, sort ${randomSort}`);
    
    const response = await fetch(
      `https://api.beatsaver.com/search/text/${randomPage}?sortOrder=${randomSort}&ranked=true`
    );
    const data = await response.json();
    
    if (data.docs && data.docs.length > 0) {
      const randomSong = data.docs[Math.floor(Math.random() * data.docs.length)];
      currentInfiniteSong = randomSong;
      
      const songAnswer = randomSong.metadata.songName.toLowerCase().trim();
      answer = songAnswer; 
      answerDisplay = randomSong.metadata.songName;
      
      if (window.antiCheat) {
        encryptedAnswer = window.antiCheat.encrypt(songAnswer);
        console.log(`Selected song: [ENCRYPTED]`);
      } else {
        console.log(`Selected song: ${answerDisplay}`);
      }
      
      if (randomSong.versions && randomSong.versions.length > 0) {
        const previewURL = randomSong.versions[0].previewURL;
        audio.src = previewURL;
        audio.currentTime = 0;
        updateTimeDisplay();
      }
      
      const savedScore = localStorage.getItem("beatdle-infinite-score");
      infiniteScore = savedScore ? parseInt(savedScore) : 0;
      updateInfiniteScoreDisplay();
    } else {
      console.log("No songs on random page, trying page 0");
      const fallbackResponse = await fetch(
        `https://api.beatsaver.com/search/text/0?sortOrder=Rating&ranked=true`
      );
      const fallbackData = await fallbackResponse.json();
      
      if (fallbackData.docs && fallbackData.docs.length > 0) {
        const randomSong = fallbackData.docs[Math.floor(Math.random() * fallbackData.docs.length)];
        currentInfiniteSong = randomSong;
        
        const songAnswer = randomSong.metadata.songName.toLowerCase().trim();
        answer = songAnswer;
        answerDisplay = randomSong.metadata.songName;
        
        if (window.antiCheat) {
          encryptedAnswer = window.antiCheat.encrypt(songAnswer);
        }
        
        if (randomSong.versions && randomSong.versions.length > 0) {
          audio.src = randomSong.versions[0].previewURL;
          audio.currentTime = 0;
          updateTimeDisplay();
        }
        
        const savedScore = localStorage.getItem("beatdle-infinite-score");
        infiniteScore = savedScore ? parseInt(savedScore) : 0;
        updateInfiniteScoreDisplay();
      }
    }
  } catch (error) {
    console.error("Failed to load infinite mode song:", error);
    showToast("Failed to load song. Please try again.");
  }
}

function updateInfiniteScoreDisplay() {
  if (infiniteScoreEl) {
    infiniteScoreEl.textContent = infiniteScore;
  }
}

function saveInfiniteScore() {
  localStorage.setItem("beatdle-infinite-score", infiniteScore.toString());
}

function nextInfiniteSong() {
  resetGame();
  lockGameControls();
  loadInfiniteMode().then(() => unlockGameControls());
}

function loadTheme() {
  const theme = localStorage.getItem("beatdle-theme") || "dark";
  document.body.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const current = document.body.getAttribute("data-theme");
  const newTheme = current === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", newTheme);
  localStorage.setItem("beatdle-theme", newTheme);
  showToast(`Switched to ${newTheme} theme`);
}

async function loadDaily(skipRestore = false) {
  try {
    const cacheBuster = `?v=${Date.now()}`;
    
    const response = await fetch(`data.json${cacheBuster}`);
    const data = await response.json();
    
    const songAnswer = data.songName.toLowerCase().trim();
    answer = songAnswer;
    answerDisplay = data.songName;
    dailyDate = data.date;
    
    if (window.antiCheat) {
      encryptedAnswer = window.antiCheat.encrypt(songAnswer);
      data.songName = "[REDACTED]";
    }
    
    if (!skipRestore) {
      const gameState = loadGameState();
      if (gameState && gameState.date === dailyDate && gameState.completed) {
        try {
          restoreGameState(gameState);
          return;
        } catch (error) {
          console.log("Error restoring old game state, clearing...", error);
          localStorage.removeItem(`beatdle-${dailyDate}`);
          showToast("Old game state cleared. Please replay today's song!");
        }
      }
    }
    
    audio.src = data.previewURL;
    audio.currentTime = 0;
    updateTimeDisplay();
  } catch (error) {
    console.error("Failed to load daily song:", error);
    showToast("Failed to load today's song. Please refresh.");
  }
}

function loadGameState() {
  if (gameMode === "infinite") return null;
  
  const key = `beatdle-${dailyDate}`;
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
}

function saveGameState() {
  if (gameMode === "infinite") return;
  
  const key = `beatdle-${dailyDate}`;
  const state = {
    date: dailyDate,
    attempts: attempts,
    previewTime: previewTime,
    guesses: Array.from(guessesContainer.children).map(el => {
      const textEl = el.querySelector('.guess-text');
      const text = textEl ? textEl.textContent : el.textContent.substring(2);
      return {
        text: text,
        type: el.classList.contains("correct") ? "correct" : 
              el.classList.contains("skip") ? "skip" : "incorrect"
      };
    }),
    completed: gameOver,
    won: gameOver && resultMessage.classList.contains("win"),
    migrated: true
  };
  localStorage.setItem(key, JSON.stringify(state));
}

function restoreGameState(state) {
  try {
    attempts = state.attempts;
    previewTime = state.previewTime;
    gameOver = state.completed;
    
    state.guesses.forEach(guess => {
      addGuess(guess.text, guess.type);
    });
    
    updateAttemptsDisplay();
    updateTimeDisplay();
    
    if (state.completed) {
      endGame(state.won);
    }
  } catch (error) {
    console.error("Error restoring game state:", error);
    throw error;
  }
}

function loadStats() {
  const defaultStats = {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    distribution: [0, 0, 0, 0, 0, 0],
    lastPlayedDate: null
  };
  const saved = localStorage.getItem("beatdle-stats");
  return saved ? JSON.parse(saved) : defaultStats;
}

function saveStats(won, guessCount) {
  if (gameMode === "infinite") return;
  
  const stats = loadStats();
  
  if (stats.lastPlayedDate !== dailyDate) {
    stats.played++;
    stats.lastPlayedDate = dailyDate;
    
    if (won) {
      stats.wins++;
      stats.currentStreak++;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
      stats.distribution[guessCount - 1]++;
    } else {
      stats.currentStreak = 0;
    }
    
    localStorage.setItem("beatdle-stats", JSON.stringify(stats));
  }
}

function displayStats() {
  const stats = loadStats();
  document.getElementById("stat-played").textContent = stats.played;
  document.getElementById("stat-wins").textContent = stats.wins;
  document.getElementById("stat-streak").textContent = stats.currentStreak;
  document.getElementById("stat-max-streak").textContent = stats.maxStreak;
  
  const distributionEl = document.getElementById("distribution");
  distributionEl.innerHTML = "";
  
  const maxCount = Math.max(...stats.distribution, 1);
  stats.distribution.forEach((count, index) => {
    const bar = document.createElement("div");
    bar.className = "distribution-bar";
    
    const label = document.createElement("div");
    label.className = "distribution-label";
    label.textContent = index + 1;
    
    const fill = document.createElement("div");
    fill.className = "distribution-fill";
    
    const inner = document.createElement("div");
    inner.className = "distribution-inner";
    inner.style.width = `${(count / maxCount) * 100}%`;
    inner.textContent = count;
    
    fill.appendChild(inner);
    bar.appendChild(label);
    bar.appendChild(fill);
    distributionEl.appendChild(bar);
  });
}

function resetGame() {
  attempts = 0;
  previewTime = 3;
  gameOver = false;
  isPlaying = false;
  
  guessesContainer.innerHTML = "";
  
  playBtn.disabled = false;
  skipBtn.disabled = false;
  guessInput.disabled = false;
  guessInput.value = "";
  
  gameOverDiv.classList.add("hidden");
  
  updateAttemptsDisplay();
  updateTimeDisplay();
  
  progressBar.style.width = "0%";
  currentTimeEl.textContent = "0:00";
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function updateTimeDisplay() {
  totalTimeEl.textContent = formatTime(previewTime);
  previewTimeDisplay.textContent = `${previewTime}s`;
}

function updateAttemptsDisplay() {
  attemptsCount.textContent = `${attempts}/${maxAttempts}`;
}

function playPreview() {
  if (isPlaying || gameOver) return;
  
  audio.currentTime = 0;
  const playPromise = audio.play();
  
  if (playPromise !== undefined) {
    playPromise.then(() => {
      isPlaying = true;
      playBtn.classList.add("playing");
      visualizer.classList.add("active");
      
      const startTime = Date.now();
      previewInterval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min((elapsed / previewTime) * 100, 100);
        
        progressBar.style.width = `${progress}%`;
        currentTimeEl.textContent = formatTime(elapsed);
        
        if (elapsed >= previewTime) {
          stopPreview();
        }
      }, 50);
    }).catch(() => {
      showToast("Unable to play audio. Please try again.");
    });
  }
}

function stopPreview() {
  audio.pause();
  isPlaying = false;
  playBtn.classList.remove("playing");
  visualizer.classList.remove("active");
  clearInterval(previewInterval);
  progressBar.style.width = "100%";
  currentTimeEl.textContent = formatTime(previewTime);
}

function skipGuess() {
  if (gameOver) return;
  
  attempts++;
  previewTime += 2;
  addGuess("Skip", "skip");
  updateAttemptsDisplay();
  updateTimeDisplay();
  
  if (attempts >= maxAttempts) {
    endGame(false);
  } else {
    playPreview();
  }
  
  saveGameState();
}

let autocompleteTimeout;
async function handleInput() {
  const query = guessInput.value.trim();
  
  clearTimeout(autocompleteTimeout);
  
  if (query.length < 2) {
    autocompleteResults.innerHTML = "";
    return;
  }
  
  autocompleteTimeout = setTimeout(async () => {
    try {
      const response = await fetch(
        `https://api.beatsaver.com/search/text/0?q=${encodeURIComponent(query)}&ranked=true`
      );
      const data = await response.json();
      
      displayAutocomplete(data.docs.slice(0, 5));
    } catch (error) {
      console.error("Autocomplete error:", error);
    }
  }, 300);
}

function displayAutocomplete(songs) {
  autocompleteResults.innerHTML = "";
  
  if (songs.length === 0) {
    const noResults = document.createElement("div");
    noResults.className = "autocomplete-item";
    noResults.textContent = "No ranked songs found";
    noResults.style.cursor = "default";
    autocompleteResults.appendChild(noResults);
    return;
  }
  
  songs.forEach(song => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    
    const songName = song.metadata.songName;
    const artist = song.metadata.songAuthorName;
    
    item.innerHTML = `<strong>${songName}</strong><br><small style="color: var(--text-muted)">${artist}</small>`;
    item.onclick = () => submitGuess(songName);
    
    autocompleteResults.appendChild(item);
  });
}

function submitGuess(songName) {
  if (gameOver) return;
  
  if (window.antiCheat && !window.antiCheat.checkOnGuess()) {
    return;
  }
  
  guessInput.value = "";
  autocompleteResults.innerHTML = "";
  
  const decryptedAnswer = window.antiCheat ? window.antiCheat.decrypt(encryptedAnswer) : answer;
  const isCorrect = songName.toLowerCase().trim() === decryptedAnswer.toLowerCase().trim();
  
  attempts++;
  addGuess(songName, isCorrect ? "correct" : "incorrect");
  updateAttemptsDisplay();
  
  if (isCorrect) {
    endGame(true);
  } else {
    previewTime += 2;
    updateTimeDisplay();
    
    if (attempts >= maxAttempts) {
      endGame(false);
    } else {
      playPreview();
    }
  }
  
  saveGameState();
}

function addGuess(text, type) {
  const guess = document.createElement("div");
  guess.className = `guess-item ${type}`;
  
  const icon = document.createElement("span");
  icon.className = "guess-icon";
  icon.textContent = type === "correct" ? "✓" : type === "skip" ? "⏭" : "✗";
  
  const label = document.createElement("span");
  label.className = "guess-text";
  label.textContent = text;
  
  guess.appendChild(icon);
  guess.appendChild(label);
  guessesContainer.appendChild(guess);
}

function endGame(won) {
  gameOver = true;
  
  playBtn.disabled = true;
  skipBtn.disabled = true;
  
  gameOverDiv.classList.remove("hidden");
  
  if (won) {
    resultMessage.textContent = `🎉 Correct! The song was: ${answerDisplay}`;
    resultMessage.className = "result-message win";
    
    if (gameMode === "infinite") {
      infiniteScore++;
      saveInfiniteScore();
      updateInfiniteScoreDisplay();
    }
  } else {
    resultMessage.textContent = `😔 Sorry, you failed! The song was: ${answerDisplay}`;
    resultMessage.className = "result-message lose";
  }
  
  if (gameMode === "daily") {
    const guessCount = won ? attempts : maxAttempts;
    saveStats(won, guessCount);
    saveGameState();
  }
  
  if (gameMode === "infinite") {
    resetBtn.style.display = "block";
    
    if (window.leaderboardAPI) {
      window.leaderboardAPI.showPrompt();
    }
  } else {
    resetBtn.style.display = "none";
  }
}

function shareResult() {
  const guesses = Array.from(guessesContainer.children);
  const squares = guesses.map(el => {
    if (el.classList.contains("correct")) return "🟩";
    if (el.classList.contains("skip")) return "⬜";
    return "⬛";
  }).join("");
  
  let text;
  if (gameMode === "infinite") {
    text = `Beatdle Infinite Mode\nScore: ${infiniteScore}\n${squares}\nhttps://evanblokender.org/saberdle`;
  } else {
    text = `Beatdle ${dailyDate}\n${squares}\nhttps://evanblokender.org/saberdle`;
  }
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Result copied to clipboard!");
    }).catch(() => {
      showToast("Failed to copy result");
    });
  } else {
    showToast("Clipboard not available");
  }
}

function updateCountdown() {
  const now = new Date();
  
  const estOffset = -5 * 60;
  const nowEST = new Date(now.getTime() + (estOffset + now.getTimezoneOffset()) * 60 * 1000);
  
  const tomorrow = new Date(nowEST);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const nextMidnightEST = new Date(tomorrow.getTime() - (estOffset + now.getTimezoneOffset()) * 60 * 1000);
  
  const diff = nextMidnightEST - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  countdownEl.textContent = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function openModal(modal) {
  modal.classList.add("show");
  document.body.classList.add("modal-open");
  if (modal === statsModal) {
    displayStats();
  }
}

function closeModal(modal) {
  modal.classList.remove("show");
  document.body.classList.remove("modal-open");
}

function setupEventListeners() {
  playBtn.addEventListener("click", playPreview);
  skipBtn.addEventListener("click", skipGuess);
  
  guessInput.addEventListener("input", handleInput);
  guessInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && autocompleteResults.children.length > 0) {
      const firstResult = autocompleteResults.children[0];
      if (firstResult.textContent !== "No ranked songs found") {
        firstResult.click();
      }
    }
  });
  
  document.addEventListener("click", (e) => {
    if (!guessInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
      autocompleteResults.innerHTML = "";
    }
  });
  
  shareBtn.addEventListener("click", shareResult);
  
  if (modeBtn) {
    modeBtn.addEventListener("click", () => openModal(modeModal));
  }
  
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      nextInfiniteSong();
    });
  }
  
  document.querySelectorAll(".mode-option").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const mode = e.currentTarget.dataset.mode;
      switchMode(mode);
    });
  });
  
  helpBtn?.addEventListener("click", () => openModal(helpModal));
  statsBtn?.addEventListener("click", () => openModal(statsModal));
  
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal");
      closeModal(modal);
    });
  });
  
  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal(helpModal);
      closeModal(statsModal);
      closeModal(modeModal);
    }
  });
}


(function initLiquidButtons() {
  function addRipple(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement('span');
    ripple.className = 'ripple-wave';
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${x - size/2}px;top:${y - size/2}px;`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
    btn.style.setProperty('--x', (x/rect.width*100)+'%');
    btn.style.setProperty('--y', (y/rect.height*100)+'%');
  }
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.liquid-btn');
    if (btn) addRipple({ currentTarget: btn, clientX: e.clientX, clientY: e.clientY });
  }, { passive: true });
})();

const _origPlayPreview = typeof playPreview === 'function' ? playPreview : null;
const _origStopPreview = typeof stopPreview === 'function' ? stopPreview : null;

function _updateVisualizerState(playing) {
  const viz = document.getElementById('visualizer');
  const playBtnEl = document.getElementById('play-btn');
  if (viz) viz.classList.toggle('active', playing);
  if (playBtnEl) playBtnEl.classList.toggle('playing', playing);
  const playIcon = playBtnEl?.querySelector('.play-icon');
  const pauseIcon = playBtnEl?.querySelector('.pause-icon');
  if (playIcon) playIcon.style.display = playing ? 'none' : 'block';
  if (pauseIcon) pauseIcon.style.display = playing ? 'block' : 'none';
}

if (typeof audio !== 'undefined' && audio) {
  audio.addEventListener('play', () => _updateVisualizerState(true));
  audio.addEventListener('pause', () => _updateVisualizerState(false));
  audio.addEventListener('ended', () => _updateVisualizerState(false));
}


/* ═══════════════════════════════════════════════════════
   SETTINGS SYSTEM
   ═══════════════════════════════════════════════════════ */

const DEFAULT_SETTINGS = {
  previewStart: 3,
  previewIncrement: 2,
  maxAttempts: 6,
  autoplay: true,
  theme: 'dark',
  sidebar: true,
  visualizer: true,
};

function loadSettings() {
  try {
    const saved = localStorage.getItem('saberdle_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(settings) {
  try { localStorage.setItem('saberdle_settings', JSON.stringify(settings)); } catch {}
}

function applySettings(settings) {
  // Apply theme
  document.body.setAttribute('data-theme', settings.theme || 'dark');
  // Apply sidebar visibility
  const sidebar = document.getElementById('sidebar-panel');
  if (sidebar) sidebar.style.display = settings.sidebar ? '' : 'none';
  // Apply visualizer visibility
  const viz = document.getElementById('visualizer');
  if (viz) viz.style.display = settings.visualizer ? '' : 'none';
  // Apply gameplay settings (global vars)
  if (typeof maxAttempts !== 'undefined') {
    window._settingsMaxAttempts = settings.maxAttempts;
  }
  window._settingsPreviewIncrement = settings.previewIncrement;
  window._settingsAutoplay = settings.autoplay;
}

function initSettingsModal() {
  const settings = loadSettings();

  const sliders = [
    { id: 'setting-preview-start', valId: 'setting-preview-start-val', key: 'previewStart', suffix: 's' },
    { id: 'setting-preview-increment', valId: 'setting-preview-increment-val', key: 'previewIncrement', suffix: 's' },
    { id: 'setting-max-attempts', valId: 'setting-max-attempts-val', key: 'maxAttempts', suffix: '' },
  ];

  sliders.forEach(({ id, valId, key, suffix }) => {
    const el = document.getElementById(id);
    const valEl = document.getElementById(valId);
    if (!el || !valEl) return;
    el.value = settings[key];
    valEl.textContent = settings[key] + suffix;
    el.addEventListener('input', () => {
      const val = parseInt(el.value);
      valEl.textContent = val + suffix;
      settings[key] = val;
      saveSettings(settings);
      applySettings(settings);
    });
  });

  const toggles = [
    { id: 'setting-autoplay', key: 'autoplay' },
    { id: 'setting-sidebar', key: 'sidebar' },
    { id: 'setting-visualizer', key: 'visualizer' },
  ];

  toggles.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = settings[key];
    el.addEventListener('change', () => {
      settings[key] = el.checked;
      saveSettings(settings);
      applySettings(settings);
    });
  });

  const themeSelect = document.getElementById('setting-theme');
  if (themeSelect) {
    themeSelect.value = settings.theme;
    themeSelect.addEventListener('change', () => {
      settings.theme = themeSelect.value;
      saveSettings(settings);
      applySettings(settings);
    });
  }

  document.getElementById('setting-reset-stats')?.addEventListener('click', () => {
    if (confirm('Reset all statistics? This cannot be undone.')) {
      localStorage.removeItem('beatdle-stats');
      showToast('Statistics reset.');
    }
  });

  document.getElementById('setting-reset-infinite')?.addEventListener('click', () => {
    if (confirm('Reset your infinite score to 0?')) {
      localStorage.setItem('beatdle-infinite-score', '0');
      if (typeof infiniteScore !== 'undefined') {
        // eslint-disable-next-line no-global-assign
        infiniteScore = 0;
        if (typeof updateInfiniteScoreDisplay === 'function') updateInfiniteScoreDisplay();
      }
      showToast('Infinite score reset.');
    }
  });

  document.getElementById('setting-export')?.addEventListener('click', () => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('beatdle') || key.startsWith('saberdle'))) {
        try { data[key] = JSON.parse(localStorage.getItem(key)); } catch { data[key] = localStorage.getItem(key); }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'saberdle-data.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported!');
  });

  applySettings(settings);
}

/* Override previewTime increment to respect settings */
const _origSkipGuess = typeof skipGuess === 'function' ? skipGuess.toString() : null;

/* Patch skipGuess to use settings increment */
const _nativeSkipGuess = window.skipGuess || skipGuess;
function skipGuess() {
  if (gameOver) return;
  const inc = window._settingsPreviewIncrement || 2;
  attempts++;
  previewTime += inc;
  addGuess("Skip", "skip");
  updateAttemptsDisplay();
  updateTimeDisplay();
  if (attempts >= (window._settingsMaxAttempts || maxAttempts)) {
    endGame(false);
  } else if (window._settingsAutoplay !== false) {
    playPreview();
  }
  saveGameState();
}

/* ═══════════════════════════════════════════════════════
   SIDEBAR LEADERBOARD
   ═══════════════════════════════════════════════════════ */

function updateSidebarLeaderboard() {
  const list = document.getElementById('sidebar-lb-list');
  if (!list) return;

  // Pull from leaderboardData if available
  const data = typeof leaderboardData !== 'undefined' ? leaderboardData : [];
  if (!data.length) {
    list.innerHTML = '<div class="sidebar-empty">No scores yet. Be the first!</div>';
    return;
  }

  const myUsername = window.googleAuth?.getUsername() || '';
  const sorted = [...data].sort((a, b) => (b.score || 0) - (a.score || 0));

  list.innerHTML = '';
  sorted.slice(0, 25).forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'sidebar-lb-row';
    if (myUsername && entry.username?.toLowerCase() === myUsername.toLowerCase()) {
      row.classList.add('current-user');
    }
    const medals = ['🥇', '🥈', '🥉'];
    const rank = medals[i] || `#${i + 1}`;
    row.innerHTML = `
      <span class="sidebar-rank">${rank}</span>
      <span class="sidebar-username">${entry.username || 'Unknown'}</span>
      <span class="sidebar-score">${entry.score ?? 0}</span>
    `;
    list.appendChild(row);
  });
}

/* Hook into leaderboard data updates */
const _origUpdateLeaderboardDisplay = typeof updateLeaderboardDisplay === 'function' ? updateLeaderboardDisplay : null;
if (_origUpdateLeaderboardDisplay) {
  window.updateLeaderboardDisplay = function() {
    _origUpdateLeaderboardDisplay();
    updateSidebarLeaderboard();
  };
}

document.addEventListener('DOMContentLoaded', () => {
  // Settings button
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  settingsBtn?.addEventListener('click', () => {
    settingsModal?.classList.add('show');
    document.body.classList.add('modal-open');
  });

  // Sidebar refresh
  document.getElementById('sidebar-refresh-btn')?.addEventListener('click', () => {
    const list = document.getElementById('sidebar-lb-list');
    if (list) list.innerHTML = '<div class="sidebar-empty">Refreshing…</div>';
    if (typeof window.leaderboardAPI?.load === 'function') {
      window.leaderboardAPI.load().then(() => updateSidebarLeaderboard());
    } else {
      updateSidebarLeaderboard();
    }
  });

  // Init settings
  initSettingsModal();

  // Patch updateLeaderboardDisplay after leaderboard.js loaded
  setTimeout(() => {
    if (typeof updateLeaderboardDisplay === 'function' && !window._sidebarPatched) {
      window._sidebarPatched = true;
      const orig = updateLeaderboardDisplay;
      window.updateLeaderboardDisplay = function() {
        orig();
        updateSidebarLeaderboard();
      };
    }
    updateSidebarLeaderboard();
  }, 1500);
});

/* ═══════════════════════════════════════════════════════
   MOD MENU PATCHES — Expose globals the mod menu needs
   ═══════════════════════════════════════════════════════ */

// Expose functions and state the mod menu references
window.endGame = typeof endGame === 'function' ? endGame : window.endGame;
window.skipGuess = skipGuess;
window.playPreview = typeof playPreview === 'function' ? playPreview : window.playPreview;
window.infiniteScore = typeof infiniteScore !== 'undefined' ? infiniteScore : 0;
window.saveInfiniteScore = typeof saveInfiniteScore === 'function' ? saveInfiniteScore : window.saveInfiniteScore;
window.updateInfiniteScoreDisplay = typeof updateInfiniteScoreDisplay === 'function' ? updateInfiniteScoreDisplay : window.updateInfiniteScoreDisplay;
window.showUsernamePrompt = typeof showUsernamePrompt === 'function' ? showUsernamePrompt : window.showUsernamePrompt;

// Expose antiCheat instance globally (mod menu reads window.antiCheat)
// AntiCheat is already set to window.antiCheat in main.js init

// Expose leaderboard helpers for mod menu
window.fetchSessionToken = typeof fetchSessionToken === 'function' ? fetchSessionToken : window.fetchSessionToken;
window.submitToLeaderboard = typeof submitToLeaderboard === 'function' ? submitToLeaderboard : window.submitToLeaderboard;
window.loadLeaderboard = typeof loadLeaderboard === 'function' ? loadLeaderboard : window.loadLeaderboard;
