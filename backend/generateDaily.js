import fs from "fs";
import fetch from "node-fetch";

// 🔥 TRUE RANDOM — no seed, no determinism yea chatgpt i know what this does, you dont need to fucking remind me.
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function pickRankedMap() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const page = Math.floor(Math.random() * 50);

    const res = await fetch(
      `https://api.beatsaver.com/search/text/${page}?q=&ranked=true`
    );
    const data = await res.json();

    if (!data.docs || data.docs.length === 0) continue;

    const shuffled = shuffleArray(data.docs);

    for (const map of shuffled) {
      if (
        map &&
        map.versions &&
        map.versions.length > 0 &&
        map.versions[0].previewURL
      ) {
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
      date: new Date().toISOString(),
      mapId: map.id,
      songName: map.metadata.songName,
      previewURL: map.versions[0].previewURL
    };

    if (!fs.existsSync("./docs")) fs.mkdirSync("./docs");
    fs.writeFileSync("./docs/data.json", JSON.stringify(daily, null, 2));

    console.log("Picked map:", daily.songName);
  } catch (err) {
    console.error("Error generating map:", err);
    process.exit(1);
  }
})();
