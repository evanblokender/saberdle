const audio = new Audio();
let previewTime = 3;
let isPlaying = false;

const playBtn = document.getElementById("play");
const progressBar = document.getElementById("progress-bar");
const timeEl = document.getElementById("time");
const durationEl = document.getElementById("duration");

let previewInterval;

function formatTime(sec) {
  const m = Math.floor(sec/60);
  const s = Math.floor(sec%60);
  return `${m}:${s.toString().padStart(2,"0")}`;
}

export function setAudioSource(src) {
  audio.src = src;
  audio.currentTime = 0;
  audio.pause();
  durationEl.textContent = formatTime(previewTime);
  progressBar.style.width = "0%";
}

export function playPreview() {
  if (isPlaying) return;
  audio.currentTime = 0;
  audio.play();
  isPlaying = true;

  const start = Date.now();
  previewInterval = setInterval(()=>{
    const elapsed = (Date.now()-start)/1000;
    const percent = Math.min(elapsed/previewTime*100,100);
    progressBar.style.width = percent+"%";
    timeEl.textContent = formatTime(elapsed);
    if (elapsed>=previewTime) stopPreview();
  },50);
}

export function stopPreview() {
  audio.pause();
  isPlaying=false;
  clearInterval(previewInterval);
  progressBar.style.width="100%";
  timeEl.textContent = formatTime(previewTime);
}

playBtn.onclick = playPreview;
