let previewTime = 3;
let attempts = 0;
const maxAttempts = 6;

const audio = document.getElementById("audio"); 
const playBtn = document.getElementById("play");
const skipBtn = document.getElementById("skip");
const progressBar = document.getElementById("progress-bar");
const timeEl = document.getElementById("time");
const durationEl = document.getElementById("duration");
const guessInput = document.getElementById("guess");
const results = document.getElementById("results");
const guessesDiv = document.getElementById("guesses");
const shareBtn = document.getElementById("share");
const answerDiv = document.getElementById("answer");

let isPlaying = false;
let previewInterval = null;
let answer = "";
let dailyKey = ""; // unique key for today

// Cookie helpers
function setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + (days*24*60*60*1000));
  document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/`;
}

function getCookie(name) {
  const c = document.cookie.split('; ').find(row => row.startsWith(name+'='));
  return c ? c.split('=')[1] : null;
}

// load daily map
async function loadDaily() {
  const d = await fetch("data.json").then(r => r.json());
  answer = d.songName.toLowerCase();
  dailyKey = "beatdle-" + d.date;

  // check if already completed today
  if(getCookie(dailyKey)) {
    disableGame("You already played today's Beatdle! Come back tomorrow.");
    return;
  }

  audio.src = d.previewURL;
  audio.currentTime = 0;
  durationEl.textContent = formatTime(previewTime);
  timeEl.textContent = "0:00";
  progressBar.style.width = "0%";
}
loadDaily();

function disableGame(msg) {
  playBtn.disabled = true;
  skipBtn.disabled = true;
  guessInput.disabled = true;
  answerDiv.textContent = msg;
}

// Format seconds
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Play preview
function playPreview() {
  if (isPlaying) return;
  audio.currentTime = 0;
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      alert("Click Play Preview to start playback");
      return;
    });
  }
  isPlaying = true;

  const start = Date.now();
  previewInterval = setInterval(() => {
    const elapsed = (Date.now() - start) / 1000;
    progressBar.style.width = Math.min(elapsed / previewTime * 100, 100) + "%";
    timeEl.textContent = formatTime(elapsed);
    if (elapsed >= previewTime) stopPreview();
  }, 50);
}

// Stop preview
function stopPreview() {
  audio.pause();
  isPlaying = false;
  clearInterval(previewInterval);
  progressBar.style.width = "100%";
  timeEl.textContent = formatTime(previewTime);
}

// Event listeners
playBtn.onclick = playPreview;

skipBtn.onclick = () => {
  attempts++;
  previewTime += 2;
  addGuess("⏭ Skip", false);
  if (attempts >= maxAttempts) endGame();
  playPreview();
};

// Autocomplete
guessInput.oninput = async () => {
  results.innerHTML = "";
  const q = guessInput.value.trim();
  if (q.length < 2) return;

  const data = await fetch(`https://api.beatsaver.com/search/text/0?q=${encodeURIComponent(q)}&ranked=true`)
    .then(r => r.json());

  data.docs.slice(0, 5).forEach(m => {
    const div = document.createElement("div");
    div.textContent = m.metadata.songName;
    div.onclick = () => submitGuess(m.metadata.songName);
    results.appendChild(div);
  });
};

// Submit guess
function submitGuess(text) {
  guessInput.value = "";
  results.innerHTML = "";
  if (text.toLowerCase() === answer) {
    addGuess(text, true);
    winGame();
  } else {
    attempts++;
    previewTime += 2;
    addGuess(text, false);
    if (attempts >= maxAttempts) endGame();
    playPreview();
  }
}

// Add guess to DOM
function addGuess(text, correct) {
  const div = document.createElement("div");
  div.textContent = (correct ? "✅ " : "❌ ") + text;
  div.style.background = correct ? "#00b894" : "#d63031";
  div.style.padding = "8px";
  div.style.marginBottom = "6px";
  div.style.borderRadius = "8px";
  guessesDiv.appendChild(div);
}

// Win
function winGame() {
  answerDiv.textContent = `🎉 Correct! The song was: ${answer}`;
  shareBtn.hidden = false;
  setCookie(dailyKey, "done", 1);
  disableGame("You already played today's Beatdle! Come back tomorrow.");
}

// End
function endGame() {
  answerDiv.textContent = `LMFAO HOW ARE YOU THIS BAD YOU ARE Out of guesses! The song was: ${answer}`;
  shareBtn.hidden = false;
  setCookie(dailyKey, "done", 1);
  disableGame("You already played today's Beatdle! Come back tomorrow.");
}

// Share
shareBtn.onclick = () => {
  const squares = Array.from(guessesDiv.children)
    .map(d => d.textContent.includes("✅") ? "🟩" : "⬛")
    .join("");
  navigator.clipboard.writeText(`Beatdle ${new Date().toISOString().slice(0, 10)}\n${squares}`);
};
