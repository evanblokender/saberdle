//i know it looks vibe coded, TRUST ITS NOT, i only used ai to add comments so i can find and easily debug something.
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
const APP_VERSION = "2.3.6";

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
  
  // Initialize leaderboard if available
  if (window.leaderboardAPI) {
    window.leaderboardAPI.init();
  }
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
      console.log("No songs found on page " + randomPage + ", trying page 0");
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
          console.log(`Selected song: [ENCRYPTED]`);
        }
        
        if (randomSong.versions && randomSong.versions.length > 0) {
          const previewURL = randomSong.versions[0].previewURL;
          audio.src = previewURL;
          audio.currentTime = 0;
          updateTimeDisplay();
        }
      }
    }
  } catch (error) {
    console.error("Error loading infinite mode:", error);
    showToast("Error loading song. Please try again.");
  }
}

// Next Infinite Song
async function nextInfiniteSong() {
  resetGame();
  await loadInfiniteMode();
}

// Load Daily Challenge
async function loadDaily(skipRestore = false) {
  const now = new Date();
  const estDate = new Date(now.getTime() + (-5 - now.getTimezoneOffset()) * 60000);
  const todayStr = estDate.toISOString().split('T')[0];
  
  const savedGameState = localStorage.getItem(`beatdle-${todayStr}`);
  
  if (savedGameState && !skipRestore) {
    try {
      const state = JSON.parse(savedGameState);
      
      dailyDate = todayStr;
      attempts = state.attempts;
      gameOver = state.gameOver;
      answer = state.answer;
      answerDisplay = state.answerDisplay;
      encryptedAnswer = state.encryptedAnswer || state.answer;
      
      guessesContainer.innerHTML = '';
      state.guesses.forEach(guessData => {
        addGuess(guessData.text, guessData.type);
      });
      
      updateAttemptsDisplay();
      
      if (gameOver) {
        gameOverDiv.classList.remove("hidden");
        if (state.won) {
          resultMessage.textContent = `🎉 Correct! The song was: ${answerDisplay}`;
          resultMessage.className = "result-message win";
        } else {
          resultMessage.textContent = `😔 Sorry, you failed! The song was: ${answerDisplay}`;
          resultMessage.className = "result-message lose";
        }
        playBtn.disabled = true;
        skipBtn.disabled = true;
        guessInput.disabled = true;
      }
      
      audio.src = state.audioURL;
      audio.currentTime = 0;
      updateTimeDisplay();
      
      console.log(`Restored game state for ${todayStr}`);
    } catch (error) {
      console.error("Error restoring game state:", error);
    }
  }
  
  if (!gameOver) {
    try {
      const response = await fetch('data.json');
      const songData = await response.json();
      
      const songAnswer = songData.songName.toLowerCase().trim();
      answer = songAnswer;
      answerDisplay = songData.songName;
      dailyDate = todayStr;
      
      if (window.antiCheat) {
        encryptedAnswer = window.antiCheat.encrypt(songAnswer);
        console.log(`Today's song: [ENCRYPTED]`);
      } else {
        console.log(`Today's song: ${answerDisplay}`);
      }
      
      audio.src = songData.previewURL;
      audio.currentTime = 0;
      updateTimeDisplay();
    } catch (error) {
      console.error("Error loading daily song:", error);
      showToast("Error loading today's song. Please try again later.");
    }
  }
}

// Theme Management
function loadTheme() {
  const theme = localStorage.getItem('beatdle-theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('beatdle-theme', newTheme);
}

// Audio Functions
function playPreview() {
  if (!audio.src) {
    showToast("Song audio not loaded yet");
    return;
  }
  
  audio.currentTime = 0;
  audio.play().catch(err => console.error("Play error:", err));
  isPlaying = true;
  updatePlayButtonState();
  
  // Animate visualizer
  if (visualizer) {
    visualizer.classList.add('active');
  }
  
  previewInterval = setInterval(() => {
    updateProgressBar();
    if (audio.currentTime >= previewTime) {
      audio.pause();
      isPlaying = false;
      updatePlayButtonState();
      clearInterval(previewInterval);
      if (visualizer) {
        visualizer.classList.remove('active');
      }
      progressBar.style.width = '0%';
    }
  }, 100);
}

function updateProgressBar() {
  if (audio && audio.duration) {
    const percent = (audio.currentTime / previewTime) * 100;
    progressBar.style.width = Math.min(percent, 100) + '%';
    currentTimeEl.textContent = formatTime(audio.currentTime);
  }
}

function updatePlayButtonState() {
  if (isPlaying) {
    playBtn.classList.add('playing');
  } else {
    playBtn.classList.remove('playing');
  }
}

function skipGuess() {
  if (gameOver) return;
  
  addGuess("Skipped", "skip");
  attempts++;
  updateAttemptsDisplay();
  previewTime += 2;
  updateTimeDisplay();
  
  if (attempts >= maxAttempts) {
    endGame(false);
  } else {
    playPreview();
  }
  
  saveGameState();
}

// Update Time Display
function updateTimeDisplay() {
  if (audio.duration) {
    totalTimeEl.textContent = formatTime(Math.min(previewTime, audio.duration));
  } else {
    totalTimeEl.textContent = formatTime(previewTime);
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Update Attempts Display
function updateAttemptsDisplay() {
  attemptsCount.textContent = `${attempts}/${maxAttempts}`;
}

// Update Infinite Score Display
function updateInfiniteScoreDisplay() {
  if (infiniteScoreEl) {
    infiniteScoreEl.textContent = infiniteScore;
  }
  const scoreDisplay = document.getElementById("score-display");
  if (scoreDisplay) {
    scoreDisplay.textContent = infiniteScore;
  }
}

// Save Infinite Score
function saveInfiniteScore() {
  localStorage.setItem("beatdle-infinite-score", infiniteScore);
}

// Save Game State (daily only)
function saveGameState() {
  if (gameMode !== "daily") return;
  
  const guessData = Array.from(guessesContainer.children).map(el => ({
    text: el.querySelector('.guess-text').textContent,
    type: el.className.match(/(correct|incorrect|skip)/)?.[0] || 'incorrect'
  }));
  
  const state = {
    attempts,
    gameOver,
    guesses: guessData,
    answer,
    answerDisplay,
    encryptedAnswer,
    audioURL: audio.src,
    won: resultMessage.classList.contains('win'),
    migrated: true
  };
  
  localStorage.setItem(`beatdle-${dailyDate}`, JSON.stringify(state));
}

// Stats Management
function saveStats(won, guessCount) {
  let stats = JSON.parse(localStorage.getItem('beatdle-stats') || '{}');
  
  stats.played = (stats.played || 0) + 1;
  stats.wins = (stats.wins || 0) + (won ? 1 : 0);
  stats.lastPlayed = dailyDate;
  
  // Streak logic
  const now = new Date();
  const estDate = new Date(now.getTime() + (-5 - now.getTimezoneOffset()) * 60000);
  const todayStr = estDate.toISOString().split('T')[0];
  
  if (won) {
    if (stats.lastWon === todayStr) {
      // Already counted today's win
    } else if (stats.lastWon) {
      // Check if last win was yesterday
      const lastDate = new Date(stats.lastWon + 'T00:00:00Z');
      const yesterday = new Date(todayStr + 'T00:00:00Z');
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastDate.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
        stats.streak = (stats.streak || 0) + 1;
      } else {
        stats.streak = 1;
      }
    } else {
      stats.streak = 1;
    }
    stats.lastWon = todayStr;
    stats.maxStreak = Math.max(stats.maxStreak || 0, stats.streak || 0);
  } else {
    stats.streak = 0;
  }
  
  // Guess distribution (only for wins)
  if (won) {
    if (!stats.distribution) stats.distribution = {};
    const bucket = Math.min(guessCount, maxAttempts);
    stats.distribution[bucket] = (stats.distribution[bucket] || 0) + 1;
  }
  
  localStorage.setItem('beatdle-stats', JSON.stringify(stats));
}

function displayStats() {
  const stats = JSON.parse(localStorage.getItem('beatdle-stats') || '{}');
  
  document.getElementById('stat-played').textContent = stats.played || 0;
  document.getElementById('stat-wins').textContent = stats.wins || 0;
  document.getElementById('stat-streak').textContent = stats.streak || 0;
  document.getElementById('stat-max-streak').textContent = stats.maxStreak || 0;
  
  // Display guess distribution
  const distribution = document.getElementById('distribution');
  distribution.innerHTML = '';
  
  for (let i = 1; i <= maxAttempts; i++) {
    const count = stats.distribution?.[i] || 0;
    const row = document.createElement('div');
    row.className = 'distribution-row';
    
    const label = document.createElement('span');
    label.className = 'distribution-label';
    label.textContent = i === maxAttempts ? `${i}` : `${i}`;
    
    const bar = document.createElement('div');
    bar.className = 'distribution-bar';
    bar.style.width = count > 0 ? (count / (stats.wins || 1) * 100) + '%' : '0%';
    bar.textContent = count > 0 ? count : '';
    
    row.appendChild(label);
    row.appendChild(bar);
    distribution.appendChild(row);
  }
}

// Reset Game (for switching modes or next song)
function resetGame() {
  attempts = 0;
  gameOver = false;
  isPlaying = false;
  guessesContainer.innerHTML = '';
  gameOverDiv.classList.add("hidden");
  resultMessage.textContent = '';
  guessInput.disabled = false;
  guessInput.value = '';
  autocompleteResults.innerHTML = '';
  playBtn.disabled = false;
  skipBtn.disabled = false;
  previewTime = 3;
  updateTimeDisplay();
  updateAttemptsDisplay();
  
  // Stop audio and reset visualizer
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  clearInterval(previewInterval);
  isPlaying = false;
  updatePlayButtonState();
  
  if (visualizer) {
    visualizer.classList.remove('active');
  }
  progressBar.style.width = '0%';
}

// Handle Input
async function handleInput(e) {
  const query = e.target.value.trim();
  
  if (!autocompleteResults) return;
  
  if (query.length === 0) {
    autocompleteResults.innerHTML = '';
    return;
  }
  
  try {
    const response = await fetch(`https://api.beatsaver.com/search/text/${query}?sortOrder=Rating&ranked=true`);
    const data = await response.json();
    
    autocompleteResults.innerHTML = '';
    
    if (data.docs && data.docs.length > 0) {
      data.docs.slice(0, 5).forEach(song => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.textContent = song.metadata.songName;
        item.addEventListener('click', () => {
          submitGuess(song.metadata.songName);
        });
        autocompleteResults.appendChild(item);
      });
    } else {
      const item = document.createElement('div');
      item.className = 'autocomplete-item disabled';
      item.textContent = 'No ranked songs found';
      autocompleteResults.appendChild(item);
    }
  } catch (error) {
    console.error('Search error:', error);
  }
}

// Display search results
function displayResults(results) {
  autocompleteResults.innerHTML = '';
  
  results.forEach(result => {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.textContent = result;
    item.addEventListener('click', () => {
      submitGuess(result);
    });
    
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
    
    // Show leaderboard submission prompt for BOTH wins and losses
    if (window.leaderboardAPI) {
      window.leaderboardAPI.showPrompt();
    }
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
  if (guessInput) {
    guessInput.addEventListener("input", handleInput);
    guessInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && autocompleteResults && autocompleteResults.children.length > 0) {
        const firstResult = autocompleteResults.children[0];
        if (firstResult.textContent !== "No ranked songs found") {
          firstResult.click();
        }
      }
    });
  }
  
  // Close autocomplete on click outside
  document.addEventListener("click", (e) => {
    if (guessInput && autocompleteResults && !guessInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
