import fs from "fs";
import fetch from "node-fetch";

function getDaySeed() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
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

function shuffleArray(array, rand) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function pickRankedMap() {
  const seed = getDaySeed();
  const rand = seededRandom(seed);

  for (let attempt = 0; attempt < 5; attempt++) {
    const page = Math.floor(rand() * 50);
    const res = await fetch(`https://api.beatsaver.com/search/text/${page}?q=&ranked=true`);
    const data = await res.json();
    if (!data.docs || data.docs.length === 0) continue;

    const shuffled = shuffleArray(data.docs, rand);
    for (const map of shuffled) {
      if (map && map.versions && map.versions.length > 0 && map.versions[0].previewURL) {
        return map;
      }
    }
  }

  throw new Error("No valid ranked map with preview found");
}

(async () => {
  try {
    const map = await pickRankedMap();
    const daily = {
      date: getDaySeed(),
      mapId: map.id,
      songName: map.metadata.songName,
      previewURL: map.versions[0].previewURL
    };

    if (!fs.existsSync("./docs")) fs.mkdirSync("./docs");
    fs.writeFileSync("./docs/data.json", JSON.stringify(daily, null, 2));
    console.log("Daily map:", daily.songName);
  } catch (err) {
    console.error("Error generating daily map:", err);
    process.exit(1);
  }
})();
