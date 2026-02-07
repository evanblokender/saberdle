let previewTime = 3;
let attempts = 0;
const maxAttempts = 6;

const audio = document.getElementById("audio"); // hidden audio
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

// load daily map
async function loadDaily() {
  const d = await fetch("data.json").then(r => r.json());
  answer = d.songName.toLowerCase();
  audio.src = d.previewURL;
  audio.currentTime = 0;
  durationEl.textContent = formatTime(previewTime);
  timeEl.textContent = "0:00";
  progressBar.style.width = "0%";
}
loadDaily();

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function playPreview() {
  if (isPlaying) return;
  audio.currentTime = 0;
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      alert("Click the Play Preview button to start playback");
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

function stopPreview() {
  audio.pause();
  isPlaying = false;
  clearInterval(previewInterval);
  progressBar.style.width = "100%";
  timeEl.textContent = formatTime(previewTime);
}

// events
playBtn.onclick = playPreview;

skipBtn.onclick = () => {
  attempts++;
  previewTime += 2;
  addGuess("⏭ Skip", false);
  if (attempts >= maxAttempts) endGame();
  playPreview();
};

// autocomplete
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

function addGuess(text, correct) {
  const div = document.createElement("div");
  div.textContent = (correct ? "✅ " : "❌ ") + text;
  div.style.background = correct ? "#00b894" : "#d63031";
  div.style.padding = "8px";
  div.style.marginBottom = "6px";
  div.style.borderRadius = "8px";
  guessesDiv.appendChild(div);
}

function winGame() {
  answerDiv.textContent = `🎉 Correct! The song was: ${answer}`;
  shareBtn.hidden = false;
}

function endGame() {
  answerDiv.textContent = `💀 Out of guesses! The song was: ${answer}`;
  shareBtn.hidden = false;
}

shareBtn.onclick = () => {
  const squares = Array.from(guessesDiv.children)
    .map(d => d.textContent.includes("✅") ? "🟩" : "⬛")
    .join("");
  navigator.clipboard.writeText(`Beatdle ${new Date().toISOString().slice(0, 10)}\n${squares}`);
};
