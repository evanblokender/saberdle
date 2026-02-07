let previewTime = 3;
let attempts = 0;
const maxAttempts = 6;

const audio = document.getElementById("audio");
const guessInput = document.getElementById("guess");
const results = document.getElementById("results");
const guessesDiv = document.getElementById("guesses");
const shareBtn = document.getElementById("share");

let answer = "";

// Load daily map from data.json
async function loadDaily() {
  const d = await fetch("data.json").then(r => r.json());
  answer = d.songName.toLowerCase();
  audio.src = d.previewURL;
}
loadDaily();

// Play button
document.getElementById("play").onclick = () => {
  audio.currentTime = 0;
  audio.play();
  setTimeout(() => audio.pause(), previewTime * 1000);
};

// Skip button
document.getElementById("skip").onclick = () => {
  attempts++;
  previewTime += 2;
  addGuess("⏭ Skip", false);
  if (attempts >= maxAttempts) end();
};

// Autocomplete search
guessInput.oninput = async () => {
  results.innerHTML = "";
  const q = guessInput.value.trim();
  if (q.length < 2) return;

  const data = await fetch(`https://api.beatsaver.com/search/text/0?q=${encodeURIComponent(q)}&ranked=true`)
    .then(r => r.json());

  data.docs.slice(0,5).forEach(m => {
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
    win();
  } else {
    attempts++;
    previewTime += 2;
    addGuess(text, false);
    if (attempts >= maxAttempts) end();
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
function win() {
  guessesDiv.innerHTML += "<div style='background:#6c5ce7;padding:8px;border-radius:8px;margin-top:6px'>🎉 Correct! Share your score:</div>";
  shareBtn.hidden = false;
}

// End
function end() {
  guessesDiv.innerHTML += "<div style='background:#fdcb6e;padding:8px;border-radius:8px;margin-top:6px'>you are ass Out of guesses! Share your score:</div>";
  shareBtn.hidden = false;
}

// Share button
shareBtn.onclick = () => {
  const squares = Array.from(guessesDiv.children)
    .map(d => d.textContent.includes("✅") ? "🟩" : "⬛")
    .join("");
  navigator.clipboard.writeText(`Beatdle ${new Date().toISOString().slice(0,10)}\n${squares}`);
};
