// Leaderboard API Configuration
// IMPORTANT: Replace this with your Render API URL after deployment
const LEADERBOARD_API_URL = 'https://leaderboard-saber.onrender.com';

// Leaderboard State
let leaderboardData = [];
let currentUsername = localStorage.getItem('beatdle-username') || '';

// Initialize leaderboard
function initLeaderboard() {
  // Set username input if exists
  const usernameInput = document.getElementById('username-input');
  if (usernameInput && currentUsername) {
    usernameInput.value = currentUsername;
  }

  // Load leaderboard on page load
  loadLeaderboard();
}

// Load leaderboard from API
async function loadLeaderboard() {
  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/api/leaderboard`);
    const result = await response.json();

    if (result.success) {
      leaderboardData = result.data;
      updateLeaderboardDisplay();
    } else {
      console.error('Failed to load leaderboard:', result.message);
    }
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    showToast('Failed to load leaderboard. Check your API URL.');
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

    // Highlight current user
    if (entry.username.toLowerCase() === currentUsername.toLowerCase()) {
      row.classList.add('current-user');
    }

    // Medal for top 3
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

  // Add delete button listeners if admin mode
  if (isAdminMode()) {
    document.querySelectorAll('.leaderboard-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const username = e.target.dataset.username;
        deleteLeaderboardEntry(username);
      });
    });
  }
}

// Submit score to leaderboard
async function submitToLeaderboard(score) {
  const usernameInput = document.getElementById('username-input');
  const username = usernameInput ? usernameInput.value.trim() : currentUsername;

  if (!username) {
    showToast('Please enter a username first!');
    return false;
  }

  // Validate username (client-side mirror of backend)
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

    const result = await response.json();

    if (result.success) {
      currentUsername = username;
      localStorage.setItem('beatdle-username', username);
      showToast(result.message);
      loadLeaderboard(); // Refresh
      return true;
    } else {
      showToast(result.message || 'Failed to submit score');
      return false;
    }
  } catch (error) {
    console.error('Error submitting score:', error);
    showToast('Failed to submit score. Check your API URL or connection.');
    return false;
  }
}

// Delete leaderboard entry (admin only) — now uses username, not id
async function deleteLeaderboardEntry(username) {
  const adminPasswordInput = document.getElementById('admin-password-input');
  const adminPassword = adminPasswordInput ? adminPasswordInput.value.trim() : '';

  if (!adminPassword) {
    showToast('Please enter admin password');
    return;
  }

  if (!confirm(`Delete entry for "${username}"? This cannot be undone.`)) {
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

    const result = await response.json();

    if (result.success) {
      showToast('Entry deleted successfully');
      loadLeaderboard(); // Refresh
    } else {
      showToast(result.message || 'Failed to delete entry');
    }
  } catch (error) {
    console.error('Error deleting entry:', error);
    showToast('Failed to delete entry — check console for details');
  }
}

// Check if admin mode is active (password field has value)
function isAdminMode() {
  const adminPasswordInput = document.getElementById('admin-password-input');
  return adminPasswordInput && adminPasswordInput.value.trim().length > 0;
}

// Toggle admin panel visibility
function toggleAdminPanel() {
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) {
    const isVisible = adminPanel.style.display === 'block';
    adminPanel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      const adminPasswordInput = document.getElementById('admin-password-input');
      if (adminPasswordInput) adminPasswordInput.focus();
    }
  }
}

// Utility: escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Re-render leaderboard when admin password changes
function onAdminPasswordChange() {
  updateLeaderboardDisplay();
}

// Show username prompt (e.g. after infinite mode game ends)
function showUsernamePrompt() {
  const usernamePrompt = document.getElementById('username-prompt');
  if (usernamePrompt) {
    usernamePrompt.style.display = 'block';
    const usernameInput = document.getElementById('username-input');
    if (usernameInput && !usernameInput.value) {
      usernameInput.focus();
    }
  }
}

// Hide username prompt
function hideUsernamePrompt() {
  const usernamePrompt = document.getElementById('username-prompt');
  if (usernamePrompt) {
    usernamePrompt.style.display = 'none';
  }
}

// Export for use in other scripts (e.g. main.js)
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
