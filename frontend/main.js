let previewTime = 3;
let attempts = 0;
const maxAttempts = 6;

const audio = document.getElementById("audio");
const guessInput = document.getElementById("guess");
const results = document.getElementById("results");
const guessesDiv = document.getElementById("guesses");
const shareBtn = document.getElementById("share");

let answer = "";

fetch("data.json")
  .then(r => r.json())
  .then(d => {
    answer = d.songName.toLowerCase();
    audio.src = d.previewURL;
  });

document.getElementById("play").onclick = () => {
  audio.currentTime = 0;
  audio.play();
  setTimeout(() => audio.pause(), previewTime * 1000);
};

document.getElementById("skip").onclick = () => fail("⏭ Skip");

guessInput.oninput = async () => {
  results.innerHTML = "";
  if (guessInput.value.length < 2) return;

  const r = await fetch(
    `https://api.beatsaver.com/search/text/0?q=${encodeURIComponent(guessInput.value)}`
  );
  const d = await r.json();

  d.docs.slice(0,5).forEach(m => {
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
    win();
  } else {
    fail(text);
  }
}

function fail(text) {
  attempts++;
  previewTime += 2;

  const div = document.createElement("div");
  div.textContent = "❌ " + text;
  guessesDiv.appendChild(div);

  if (attempts >= maxAttempts) end();
}

function win() {
  guessesDiv.innerHTML += "<div>✅ Correct!</div>";
  shareBtn.hidden = false;
}

function end() {
  guessesDiv.innerHTML += "<div>❌ Game Over (you're so ass)</div>";
  shareBtn.hidden = false;
}

shareBtn.onclick = () => {
  const squares = Array.from(guessesDiv.children)
    .map(d => d.textContent.includes("✅") ? "🟩" : "⬛")
    .join("");

  navigator.clipboard.writeText(
    `Beatdle ${new Date().toISOString().slice(0,10)}\n${squares}`
  );
};
