import fs from "fs";
import fetch from "node-fetch";

function getDaySeed() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
}

function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h *= 16777619;
  }
  return () => {
    h += h << 13; h ^= h >> 7;
    h += h << 3; h ^= h >> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

(async () => {
  const seed = getDaySeed();
  const rand = seededRandom(seed);

  const page = Math.floor(rand() * 50);
  const res = await fetch(
    `https://api.beatsaver.com/search/text/${page}?q=&ranked=true`
  );
  const data = await res.json();

  const map = data.docs[Math.floor(rand() * data.docs.length)];

  const daily = {
    date: seed,
    mapId: map.id,
    songName: map.metadata.songName,
    previewURL: map.versions[0].previewURL
  };

  fs.writeFileSync("./frontend/data.json", JSON.stringify(daily, null, 2));
  console.log("Daily map generated:", seed);
})();
