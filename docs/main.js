// Game State
let previewTime = 3;
let attempts = 0;
const maxAttempts = 6;
let isPlaying = false;
let previewInterval = null;
let answer = "";
let answerDisplay = "";
let dailyDate = "";
let gameOver = false;

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

// Modal Elements
const helpBtn = document.getElementById("help-btn");
const statsBtn = document.getElementById("stats-btn");
const themeBtn = document.getElementById("theme-btn");
const helpModal = document.getElementById("help-modal");
const statsModal = document.getElementById("stats-modal");
const toast = document.getElementById("toast");

// Initialize
init();

function init() {
  loadTheme();
  loadDaily();
  setupEventListeners();
  updateCountdown();
  setInterval(updateCountdown, 1000);
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
async function loadDaily() {
  try {
    const data = await fetch("data.json").then(r => r.json());
    answer = data.songName.toLowerCase().trim();
    answerDisplay = data.songName;
    dailyDate = data.date;
    
    // Check if already played today
    const gameState = loadGameState();
    if (gameState && gameState.date === dailyDate && gameState.completed) {
      restoreGameState(gameState);
      return;
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
  const key = `beatdle-${dailyDate}`;
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
}

function saveGameState() {
  const key = `beatdle-${dailyDate}`;
  const state = {
    date: dailyDate,
    attempts: attempts,
    previewTime: previewTime,
    guesses: Array.from(guessesContainer.children).map(el => ({
      text: el.textContent.substring(2), // Remove emoji
      type: el.classList.contains("correct") ? "correct" : 
            el.classList.contains("skip") ? "skip" : "incorrect"
    })),
    completed: gameOver,
    won: gameOver && resultMessage.classList.contains("win")
  };
  localStorage.setItem(key, JSON.stringify(state));
}

function restoreGameState(state) {
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
}

// Statistics Management
function loadStats() {
  const defaultStats = {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    distribution: [0, 0, 0, 0, 0, 0]
  };
  const saved = localStorage.getItem("beatdle-stats");
  return saved ? JSON.parse(saved) : defaultStats;
}

function saveStats(won, guessCount) {
  const stats = loadStats();
  stats.played++;
  
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
  
  guessInput.value = "";
  autocompleteResults.innerHTML = "";
  
  const isCorrect = songName.toLowerCase().trim() === answer;
  
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
  } else {
    resultMessage.textContent = ` fuck you imagine being Out of guesses! The song was: ${answerDisplay}`;
    resultMessage.className = "result-message lose";
  }
  
  // Update stats
  const guessCount = won ? attempts : maxAttempts;
  saveStats(won, guessCount);
  saveGameState();
}

// Share Result
function shareResult() {
  const guesses = Array.from(guessesContainer.children);
  const squares = guesses.map(el => {
    if (el.classList.contains("correct")) return "🟩";
    if (el.classList.contains("skip")) return "⬜";
    return "⬛";
  }).join("");
  
  const text = `Beatdle ${dailyDate}\n${squares}\nhttps://evanblokender.org/saberdle`;
  
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
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  
  const diff = tomorrow - now;
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
    }
  });
}
