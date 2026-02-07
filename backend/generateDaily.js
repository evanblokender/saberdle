import fs from "fs/promises";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get day seed based on New York (Eastern Time)
function getDaySeed() {
  const now = new Date();
  // Convert to New York time offset
  const nyOffset = -5 * 60; // EST is UTC-5, ignoring DST
  const nyTime = new Date(now.getTime() + (nyOffset - now.getTimezoneOffset()) * 60000);

  const year = nyTime.getFullYear();
  const month = nyTime.getMonth() + 1;
  const date = nyTime.getDate();
  return `${year}-${month}-${date}`;
}

// Seeded random function
function seededRandom(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h *= 16777619;
  }
  return () => {
    h += h << 13;
    h ^= h >> 7;
    h += h << 3;
    h ^= h >> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

// Pick a ranked map with preview
async function pickRankedMap() {
  const seed = getDaySeed();
  const rand = seededRandom(seed);

  for (let attempt = 0; attempt < 5; attempt++) {
    const page = Math.floor(rand() * 50);
    const res = await fetch(`https://api.beatsaver.com/search/text/${page}?q=&ranked=true`);
    const data = await res.json();
    if (!data.docs || data.docs.length === 0) continue;

    const map = data.docs[Math.floor(rand() * data.docs.length)];
    if (map && map.versions && map.versions.length > 0 && map.versions[0].previewURL) {
      return map;
    }
  }

  throw new Error("No valid ranked map with preview found");
}

// Main function
(async () => {
  try {
    const map = await pickRankedMap();
    const daily = {
      date: getDaySeed(),
      mapId: map.id,
      songName: map.metadata.songName,
      previewURL: map.versions[0].previewURL
    };

    const docsPath = path.join(__dirname, "docs");
    try {
      await fs.access(docsPath);
    } catch {
      await fs.mkdir(docsPath);
    }

    await fs.writeFile(path.join(docsPath, "data.json"), JSON.stringify(daily, null, 2), "utf-8");
    console.log("Daily map:", daily.songName);
  } catch (err) {
    console.error("Error generating daily map:", err);
    process.exit(1);
  }
})();
