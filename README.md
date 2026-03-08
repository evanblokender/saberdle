# Saberdle — Merged Repository

> Daily Beat Saber Song Game + Leaderboard Server in one repo.

Previously split across `saberdle` (frontend) and `leaderboard-saber` (backend), now combined.

## What's Changed

### Full-Screen UI
- Game now uses full width (max 860px) instead of narrow card
- Desktop (≥900px): two-column layout — game on left, live leaderboard sidebar on right
- Header expanded to match wider layout

### Settings Tab
- New gear icon in header opens Settings modal
- Gameplay: starting preview length (1-10s), skip increment (1-10s), max attempts (3-10), auto-play toggle
- Appearance: theme, sidebar toggle, visualizer toggle
- Data: reset stats, reset infinite score, export local data as JSON

### Fix: Refresh Logs You Out
- ID token now saved to sessionStorage (survives page refresh)
- User info restored from localStorage on load
- Silent Google prompt on load refreshes token transparently
- Refreshing page no longer logs you out

### Mod Menu Patched
All window globals the mod menu references are now properly exposed:
window.endGame, window.skipGuess, window.playPreview,
window.infiniteScore, window.saveInfiniteScore, window.updateInfiniteScoreDisplay,
window.showUsernamePrompt, window.fetchSessionToken,
window.submitToLeaderboard, window.loadLeaderboard

### Repos Merged
- leaderboard-saber server.js now lives at root
- Single package.json with npm start
- localhost:8080 and localhost:5500 added to CORS whitelist

## Structure
```
saberdle/
├── server.js          <- Express API (auth + leaderboard)
├── package.json
├── README.md
└── docs/              <- Frontend (GitHub Pages)
    ├── index.html
    ├── style.css
    ├── main.js
    ├── auth.js
    ├── leaderboard.js
    └── data.json
```

## Running Locally
```bash
npm install
npm start          # API server on PORT (default 3000)
npm run dev        # with nodemon
npm run dev:all    # backend + frontend both
```

## Environment Variables
```
PORT=3000
GOOGLE_CLIENT_ID=...
GOOGLE_ID_SALT=...
API_KEY=...
ADMIN_PASSWORD=...
```
