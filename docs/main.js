// Game State
let previewTime = 3;
let attempts = 0;
const maxAttempts = 6;
let isPlaying = false;
let previewInterval = null;
let answer = ""; // Encrypted answer stored here
let answerDisplay = "";
let dailyDate = "";
let gameOver = false;
let gameMode = "daily"; // "daily" or "infinite"
let infiniteScore = 0;
let infiniteSongs = [];
let currentInfiniteSong = null;

// Anti-cheat: Store encrypted answer separately
let encryptedAnswer = "";
let actualAnswer = ""; // The real answer, hidden from console inspection

// Version for cache busting
const APP_VERSION = "2.2.2";

// DOM Elements
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

// Modal Elements
const helpBtn = document.getElementById("help-btn");
const statsBtn = document.getElementById("stats-btn");
const themeBtn = document.getElementById("theme-btn");
const helpModal = document.getElementById("help-modal");
const statsModal = document.getElementById("stats-modal");
const modeModal = document.getElementById("mode-modal");
const toast = document.getElementById("toast");

// Initialize
init();

function init() {
  checkVersion();
  loadTheme();
  loadGameMode();
  if (gameMode === "daily") {
    loadDaily();
  } else {
    loadInfiniteMode();
  }
  setupEventListeners();
  updateCountdown();
  setInterval(updateCountdown, 1000);
}

// Version Management (Cache Busting)
function checkVersion() {
  const savedVersion = localStorage.getItem("beatdle-version");
  if (savedVersion !== APP_VERSION) {
    console.log("New version detected, migrating data");
    
    // Clear any game states in old format to prevent errors
    // (Users will just need to replay today's daily if they already completed it)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith("beatdle-2") && !key.includes("stats")) {
        const state = localStorage.getItem(key);
        try {
          const parsed = JSON.parse(state);
          // Check if it's the old format (no migrated flag)
          if (parsed && parsed.guesses && !parsed.migrated) {
            console.log(`Clearing old format state: ${key}`);
            localStorage.removeItem(key);
          }
        } catch (e) {
          // Invalid state, remove it
          localStorage.removeItem(key);
        }
      }
    }
    
    // Update version
    localStorage.setItem("beatdle-version", APP_VERSION);
    showToast("App updated! Old game states cleared.");
  }
}

// Migrate old game state formats to new format
function migrateOldGameStates() {
  // Find all beatdle game states
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("beatdle-") && key !== "beatdle-stats" && 
        key !== "beatdle-theme" && key !== "beatdle-mode" && 
        key !== "beatdle-version" && key !== "beatdle-infinite-score") {
      try {
        const state = JSON.parse(localStorage.getItem(key));
        // Check if state needs migration (old format had text with emoji prefix)
        if (state && state.guesses) {
          // Mark as migrated if not already
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

// Game Mode Management
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
  
  // Show/hide mode-specific elements
  if (gameMode === "infinite") {
    if (countdownParent) countdownParent.style.display = "none";
    if (infiniteScoreContainer) infiniteScoreContainer.style.display = "block";
    updateInfiniteScoreDisplay();
  } else {
    if (countdownParent) countdownParent.style.display = "block";
    if (infiniteScoreContainer) infiniteScoreContainer.style.display = "none";
  }
}

function switchMode(newMode) {
  console.log(`Switching from ${gameMode} to ${newMode}`);
  
  if (gameMode === newMode) {
    console.log("Already in this mode, ignoring");
    return;
  }
  
  try {
    gameMode = newMode;
    saveGameMode();
    
    // Reset game state FIRST before loading
    console.log("Resetting game...");
    resetGame();
    
    // Prevent restoration of saved state when switching modes
    // by temporarily setting a flag
    const skipRestore = true;
    
    console.log(`Loading ${gameMode} mode...`);
    if (gameMode === "daily") {
      loadDaily(skipRestore);
    } else {
      loadInfiniteMode();
    }
    
    console.log("Updating mode display...");
    updateModeDisplay();
    
    console.log("Closing modal...");
    if (modeModal) {
      closeModal(modeModal);
    }
    
    showToast(`Switched to ${gameMode === "daily" ? "Daily" : "Infinite"} Mode`);
    console.log("Mode switch complete!");
  } catch (error) {
    console.error("Error switching modes:", error);
    showToast("Error switching modes. Please refresh the page.");
  }
}

// Infinite Mode
async function loadInfiniteMode() {
  try {
    // BeatSaver API has pages of 20 songs each
    // Let's randomize which page we fetch from (0-99 gives us access to 2000 songs)
    const randomPage = Math.floor(Math.random() * 100);
    
    // Also randomize sort order to get more variety
    const sortOrders = ['Relevance', 'Rating', 'Latest'];
    const randomSort = sortOrders[Math.floor(Math.random() * sortOrders.length)];
    
    console.log(`Loading infinite mode: page ${randomPage}, sort ${randomSort}`);
    
    // Load random ranked song from BeatSaver
    const response = await fetch(
      `https://api.beatsaver.com/search/text/${randomPage}?sortOrder=${randomSort}&ranked=true`
    );
    const data = await response.json();
    
    if (data.docs && data.docs.length > 0) {
      // Get random song from this page's results
      const randomSong = data.docs[Math.floor(Math.random() * data.docs.length)];
      currentInfiniteSong = randomSong;
      
      // ANTI-CHEAT: Encrypt the answer
      const songAnswer = randomSong.metadata.songName.toLowerCase().trim();
      answer = songAnswer; // Keep for compatibility
      answerDisplay = randomSong.metadata.songName;
      
      // Encrypt and store
      if (window.antiCheat) {
        encryptedAnswer = window.antiCheat.encrypt(songAnswer);
        // Obfuscate console output
        console.log(`Selected song: [ENCRYPTED]`);
      } else {
        console.log(`Selected song: ${answerDisplay}`);
      }
      
      // Load preview URL
      if (randomSong.versions && randomSong.versions.length > 0) {
        const previewURL = randomSong.versions[0].previewURL;
        audio.src = previewURL;
        audio.currentTime = 0;
        updateTimeDisplay();
      }
      
      // Load infinite score
      const savedScore = localStorage.getItem("beatdle-infinite-score");
      infiniteScore = savedScore ? parseInt(savedScore) : 0;
      updateInfiniteScoreDisplay();
    } else {
      // If no songs found on this page, try page 0 as fallback
      console.log("No songs on random page, trying page 0");
      const fallbackResponse = await fetch(
        `https://api.beatsaver.com/search/text/0?sortOrder=Rating&ranked=true`
      );
      const fallbackData = await fallbackResponse.json();
      
      if (fallbackData.docs && fallbackData.docs.length > 0) {
        const randomSong = fallbackData.docs[Math.floor(Math.random() * fallbackData.docs.length)];
        currentInfiniteSong = randomSong;
        
        // ANTI-CHEAT: Encrypt the answer
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
  loadInfiniteMode();
}

// Theme Management
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

// Load Daily Song
async function loadDaily(skipRestore = false) {
  try {
    const cacheBuster = `?v=${Date.now()}`;
    
    // ANTI-CHEAT: Intercept fetch to prevent network tab inspection
    const response = await fetch(`data.json${cacheBuster}`);
    const data = await response.json();
    
    // ANTI-CHEAT: Immediately encrypt the answer after receiving
    // This prevents finding it in memory after the network request
    const songAnswer = data.songName.toLowerCase().trim();
    answer = songAnswer; // Keep for compatibility
    answerDisplay = data.songName;
    dailyDate = data.date;
    
    // Encrypt and store
    if (window.antiCheat) {
      encryptedAnswer = window.antiCheat.encrypt(songAnswer);
      // Overwrite the original data to prevent memory inspection
      data.songName = "[REDACTED]";
    }
    
    // Check if already played today (skip if switching modes)
    if (!skipRestore) {
      const gameState = loadGameState();
      if (gameState && gameState.date === dailyDate && gameState.completed) {
        try {
          restoreGameState(gameState);
          return;
        } catch (error) {
          // Old format state that can't be restored - clear it and start fresh
          console.log("Error restoring old game state, clearing...", error);
          localStorage.removeItem(`beatdle-${dailyDate}`);
          showToast("Old game state cleared. Please replay today's song!");
        }
      }
    }
    
    // Load audio
    audio.src = data.previewURL;
    audio.currentTime = 0;
    updateTimeDisplay();
  } catch (error) {
    console.error("Failed to load daily song:", error);
    showToast("Failed to load today's song. Please refresh.");
  }
}

// Game State Management
function loadGameState() {
  if (gameMode === "infinite") return null;
  
  const key = `beatdle-${dailyDate}`;
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
}

function saveGameState() {
  if (gameMode === "infinite") return; // Don't save state in infinite mode
  
  const key = `beatdle-${dailyDate}`;
  const state = {
    date: dailyDate,
    attempts: attempts,
    previewTime: previewTime,
    guesses: Array.from(guessesContainer.children).map(el => {
      // Handle both old format (text node) and new format (.guess-text element)
      const textEl = el.querySelector('.guess-text');
      const text = textEl ? textEl.textContent : el.textContent.substring(2); // Remove emoji prefix for old format
      return {
        text: text,
        type: el.classList.contains("correct") ? "correct" : 
              el.classList.contains("skip") ? "skip" : "incorrect"
      };
    }),
    completed: gameOver,
    won: gameOver && resultMessage.classList.contains("win"),
    migrated: true // Mark as new format
  };
  localStorage.setItem(key, JSON.stringify(state));
}

function restoreGameState(state) {
  try {
    attempts = state.attempts;
    previewTime = state.previewTime;
    gameOver = state.completed;
    
    // Restore guesses
    state.guesses.forEach(guess => {
      addGuess(guess.text, guess.type);
    });
    
    // Update display
    updateAttemptsDisplay();
    updateTimeDisplay();
    
    if (state.completed) {
      endGame(state.won);
    }
  } catch (error) {
    console.error("Error restoring game state:", error);
    // Re-throw to be caught by loadDaily
    throw error;
  }
}

// Statistics Management
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
  if (gameMode === "infinite") return; // Don't save stats in infinite mode
  
  const stats = loadStats();
  
  // Check if this is a new day (don't increment multiple times for same day)
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
  
  // Distribution
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

// Reset Game
function resetGame() {
  attempts = 0;
  previewTime = 3;
  gameOver = false;
  isPlaying = false;
  
  // Clear guesses
  guessesContainer.innerHTML = "";
  
  // Re-enable inputs
  playBtn.disabled = false;
  skipBtn.disabled = false;
  guessInput.disabled = false;
  guessInput.value = "";
  
  // Hide game over
  gameOverDiv.classList.add("hidden");
  
  // Reset displays
  updateAttemptsDisplay();
  updateTimeDisplay();
  
  // Reset progress bar
  progressBar.style.width = "0%";
  currentTimeEl.textContent = "0:00";
}

// Time Formatting
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

// Audio Playback
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

// Skip
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

// Autocomplete
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

// Submit Guess
function submitGuess(songName) {
  if (gameOver) return;
  
  // ANTI-CHEAT: Check if DevTools was opened before allowing guess
  if (window.antiCheat && !window.antiCheat.checkOnGuess()) {
    return; // User is banned, don't process guess
  }
  
  guessInput.value = "";
  autocompleteResults.innerHTML = "";
  
  // Decrypt answer for comparison
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

// Add Guess to List
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

// End Game
function endGame(won) {
  gameOver = true;
  
  // Disable inputs
  playBtn.disabled = true;
  skipBtn.disabled = true;
  guessInput.disabled = true;
  
  // Show result
  gameOverDiv.classList.remove("hidden");
  
  if (won) {
    resultMessage.textContent = `🎉 Correct! The song was: ${answerDisplay}`;
    resultMessage.className = "result-message win";
    
    // Update infinite score
    if (gameMode === "infinite") {
      infiniteScore++;
      saveInfiniteScore();
      updateInfiniteScoreDisplay();
    }
  } else {
    resultMessage.textContent = `😔 Sorry, you failed! The song was: ${answerDisplay}`;
    resultMessage.className = "result-message lose";
  }
  
  // Update stats (daily mode only)
  if (gameMode === "daily") {
    const guessCount = won ? attempts : maxAttempts;
    saveStats(won, guessCount);
    saveGameState();
  }
  
  // Show reset button in infinite mode
  if (gameMode === "infinite") {
    resetBtn.style.display = "block";
  } else {
    resetBtn.style.display = "none";
  }
}

// Share Result
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

// Countdown to Next Game
function updateCountdown() {
  const now = new Date();
  
  // Get next midnight EST (UTC-5)
  // Convert current time to EST
  const estOffset = -5 * 60; // EST is UTC-5 hours in minutes
  const nowEST = new Date(now.getTime() + (estOffset + now.getTimezoneOffset()) * 60 * 1000);
  
  // Get next midnight EST
  const tomorrow = new Date(nowEST);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  // Convert back to local time for accurate countdown
  const nextMidnightEST = new Date(tomorrow.getTime() - (estOffset + now.getTimezoneOffset()) * 60 * 1000);
  
  const diff = nextMidnightEST - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  countdownEl.textContent = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Toast Notification
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Modal Management
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

// Event Listeners
function setupEventListeners() {
  // Playback
  playBtn.addEventListener("click", playPreview);
  skipBtn.addEventListener("click", skipGuess);
  
  // Input
  guessInput.addEventListener("input", handleInput);
  guessInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && autocompleteResults.children.length > 0) {
      const firstResult = autocompleteResults.children[0];
      if (firstResult.textContent !== "No ranked songs found") {
        firstResult.click();
      }
    }
  });
  
  // Close autocomplete on click outside
  document.addEventListener("click", (e) => {
    if (!guessInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
      autocompleteResults.innerHTML = "";
    }
  });
  
  // Share
  shareBtn.addEventListener("click", shareResult);
  
  // Mode switching
  if (modeBtn) {
    modeBtn.addEventListener("click", () => openModal(modeModal));
  }
  
  // Reset button (infinite mode)
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      nextInfiniteSong();
    });
  }
  
  // Mode selection buttons
  document.querySelectorAll(".mode-option").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const mode = e.currentTarget.dataset.mode;
      switchMode(mode);
    });
  });
  
  // Modals
  helpBtn.addEventListener("click", () => openModal(helpModal));
  statsBtn.addEventListener("click", () => openModal(statsModal));
  themeBtn.addEventListener("click", toggleTheme);
  
  // Close modals
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal");
      closeModal(modal);
    });
  });
  
  // Close modal on background click
  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });
  
  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal(helpModal);
      closeModal(statsModal);
      closeModal(modeModal);
    }
  });
}
