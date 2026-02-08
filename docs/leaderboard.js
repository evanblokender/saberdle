// Leaderboard API Configuration
// IMPORTANT: Replace/update if your Render URL changes
const LEADERBOARD_API_URL = 'https://leaderboard-saber.onrender.com';

// Leaderboard State
let leaderboardData = [];
let currentUsername = localStorage.getItem('beatdle-username') || '';

// Initialize leaderboard
function initLeaderboard() {
  const usernameInput = document.getElementById('username-input');
  if (usernameInput && currentUsername) {
    usernameInput.value = currentUsername;
  }
  loadLeaderboard();
}

// Load leaderboard from API
async function loadLeaderboard() {
  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/api/leaderboard`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      leaderboardData = result.data || [];
      updateLeaderboardDisplay();
    } else {
      console.error('Failed to load leaderboard:', result.message);
      showToast('Could not load leaderboard');
    }
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    showToast('Failed to load leaderboard. Check connection.');
  }
}

// Update leaderboard display
function updateLeaderboardDisplay() {
  const leaderboardList = document.getElementById('leaderboard-list');
  if (!leaderboardList) return;

  leaderboardList.innerHTML = '';

  if (leaderboardData.length === 0) {
    leaderboardList.innerHTML = '<div class="leaderboard-empty">No scores yet. Be the first!</div>';
    return;
  }

  leaderboardData.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';

    if (entry.username.toLowerCase() === currentUsername.toLowerCase()) {
      row.classList.add('current-user');
    }

    let medal = '';
    if (index === 0) medal = '🥇';
    else if (index === 1) medal = '🥈';
    else if (index === 2) medal = '🥉';

    const date = entry.date ? new Date(entry.date) : null;
    const dateStr = date ? date.toLocaleDateString() : '—';

    row.innerHTML = `
      <span class="leaderboard-rank">${medal || `#${index + 1}`}</span>
      <span class="leaderboard-username">${escapeHtml(entry.username)}</span>
      <span class="leaderboard-score">${entry.score}</span>
      <span class="leaderboard-date">${dateStr}</span>
      ${isAdminMode() ? `<button class="leaderboard-delete" data-username="${escapeHtml(entry.username)}">🗑️</button>` : ''}
    `;

    leaderboardList.appendChild(row);
  });

  if (isAdminMode()) {
    document.querySelectorAll('.leaderboard-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const username = e.target.dataset.username;
        deleteLeaderboardEntry(username);
      });
    });
  }
}

// Submit score to leaderboard (fixed version)
async function submitToLeaderboard(score) {
  const usernameInput = document.getElementById('username-input');
  const username = usernameInput ? usernameInput.value.trim() : currentUsername;

  if (!username) {
    showToast('Please enter a username first!');
    return false;
  }

  if (username.length < 3 || username.length > 20) {
    showToast('Username must be 3-20 characters');
    return false;
  }

  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/api/leaderboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, score })
    });

    // Handle non-200 responses first
    if (!response.ok) {
      let errorMsg = `Server error (${response.status})`;
      try {
        const errData = await response.json();
        errorMsg += `: ${errData.message || 'Unknown error'}`;
      } catch {
        errorMsg += ' (could not read response)';
      }
      showToast(errorMsg);
      console.error('Server responded with error:', response.status, await response.text());
      return false;
    }

    // Parse JSON safely
    const result = await response.json();

    // Guard against weird responses (like just a number)
    if (!result || typeof result !== 'object') {
      console.error('Invalid response format:', result);
      showToast('Invalid response from server');
      return false;
    }

    if (result.success) {
      currentUsername = username;
      localStorage.setItem('beatdle-username', username);
      showToast(result.message || 'Score submitted!');
      loadLeaderboard(); // Refresh
      return true;
    } else {
      showToast(result.message || 'Failed to submit score');
      return false;
    }
  } catch (error) {
    console.error('Submit network/fetch error:', error);
    showToast('Failed to reach leaderboard server. Check your connection or the URL.');
    return false;
  }
}

// Delete leaderboard entry (admin only)
async function deleteLeaderboardEntry(username) {
  const adminPasswordInput = document.getElementById('admin-password-input');
  const adminPassword = adminPasswordInput ? adminPasswordInput.value.trim() : '';

  if (!adminPassword) {
    showToast('Please enter admin password');
    return;
  }

  if (!confirm(`Delete entry for "${username}"?`)) {
    return;
  }

  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/api/leaderboard/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ adminPassword })
    });

    if (!response.ok) {
      let errorMsg = `Delete failed (${response.status})`;
      try {
        const errData = await response.json();
        errorMsg += `: ${errData.message || 'Unknown'}`;
      } catch {}
      showToast(errorMsg);
      return;
    }

    const result = await response.json();

    if (result.success) {
      showToast('Entry deleted successfully');
      loadLeaderboard();
    } else {
      showToast(result.message || 'Failed to delete entry');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Failed to delete entry');
  }
}

// Check admin mode
function isAdminMode() {
  const adminPasswordInput = document.getElementById('admin-password-input');
  return adminPasswordInput && adminPasswordInput.value.trim().length > 0;
}

// Toggle admin panel
function toggleAdminPanel() {
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) {
    const isVisible = adminPanel.style.display === 'block';
    adminPanel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      document.getElementById('admin-password-input')?.focus();
    }
  }
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Re-render when admin password changes
function onAdminPasswordChange() {
  updateLeaderboardDisplay();
}

// Show username prompt
function showUsernamePrompt() {
  const prompt = document.getElementById('username-prompt');
  if (prompt) {
    prompt.style.display = 'block';
    document.getElementById('username-input')?.focus();
  }
}

// Hide username prompt
function hideUsernamePrompt() {
  const prompt = document.getElementById('username-prompt');
  if (prompt) prompt.style.display = 'none';
}

// Export
if (typeof window !== 'undefined') {
  window.leaderboardAPI = {
    init: initLeaderboard,
    load: loadLeaderboard,
    submit: submitToLeaderboard,
    showPrompt: showUsernamePrompt,
    hidePrompt: hideUsernamePrompt,
    toggleAdmin: toggleAdminPanel,
    onAdminPasswordChange: onAdminPasswordChange
  };
}
