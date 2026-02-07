import { setAudioSource, playPreview } from "./player.js";

let attempts = 0;
const maxAttempts = 6;

const guessInput = document.getElementById("guess");
const results = document.getElementById("results");
const guessesDiv = document.getElementById("guesses");
const shareBtn = document.getElementById("share");
const skipBtn = document.getElementById("skip");
const answerDiv = document.getElementById("answer");

let answer = "";

// Load daily map
async function loadDaily() {
  const d = await fetch("data.json").then(r=>r.json());
  answer = d.songName.toLowerCase();
  setAudioSource(d.previewURL);
}
loadDaily();

// Skip button
skipBtn.onclick = () => {
  attempts++;
  previewTime += 2;
  addGuess("⏭ Skip", false);
  if (attempts>=maxAttempts) endGame();
  playPreview();
};

// Autocomplete search
guessInput.oninput = async () => {
  results.innerHTML="";
  const q = guessInput.value.trim();
  if (q.length<2) return;

  const data = await fetch(`https://api.beatsaver.com/search/text/0?q=${encodeURIComponent(q)}&ranked=true`)
    .then(r=>r.json());

  data.docs.slice(0,5).forEach(m=>{
    const div = document.createElement("div");
    div.textContent = m.metadata.songName;
    div.onclick = ()=>submitGuess(m.metadata.songName);
    results.appendChild(div);
  });
};

// Submit guess
function submitGuess(text){
  guessInput.value="";
  results.innerHTML="";
  if(text.toLowerCase()===answer){
    addGuess(text,true);
    winGame();
  } else {
    attempts++;
    previewTime+=2;
    addGuess(text,false);
    if(attempts>=maxAttempts) endGame();
    playPreview();
  }
}

function addGuess(text, correct){
  const div = document.createElement("div");
  div.textContent = (correct?"✅ ":"❌ ")+text;
  div.style.background = correct?"#00b894":"#d63031";
  div.style.padding="8px";
  div.style.marginBottom="6px";
  div.style.borderRadius="8px";
  guessesDiv.appendChild(div);
}

// Win
function winGame(){
  answerDiv.textContent = `🎉 Correct! The song was: ${answer}`;
  shareBtn.hidden=false;
}

// End
function endGame(){
  answerDiv.textContent = `💀 YOUR SO ASS LMAO Out of guesses! The song was: ${answer}`;
  shareBtn.hidden=false;
}

// Share
shareBtn.onclick = ()=>{
  const squares = Array.from(guessesDiv.children)
    .map(d=>d.textContent.includes("✅")?"🟩":"⬛")
    .join("");
  navigator.clipboard.writeText(`Beatdle ${new Date().toISOString().slice(0,10)}\n${squares}`);
};
