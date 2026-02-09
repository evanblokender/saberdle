const LEADERBOARD_API_URL = 'https://leaderboard-saber.onrender.com
let leaderboardData = [];
let currentUsername = localStorage.getItem('beatdle-username') || '';
function initLeaderboard() {
  const usernameInput = document.getElementById('username-input');
  if (usernameInput && currentUsername) {
    usernameInput.value = currentUsername;
  }
  loadLeaderboard();
}
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
    const date = new Date(entry.date);
    const dateStr = date.toLocaleDateString();
    row.innerHTML = `
      <span class="leaderboard-rank">${medal || `#${index + 1}`}</span>
      <span class="leaderboard-username">${escapeHtml(entry.username)}</span>
      <span class="leaderboard-score">${entry.score}</span>
      <span class="leaderboard-date">${dateStr}</span>
      ${isAdminMode() ? `<button class="leaderboard-delete" data-id="${entry.id}">🗑️</button>` : ''}
    `;
    leaderboardList.appendChild(row);
  });
  if (isAdminMode()) {
    document.querySelectorAll('.leaderboard-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        deleteLeaderboardEntry(id);
      });
    });
  }
}
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
    const result = await response.json();
    if (result.success) {
      currentUsername = username;
      localStorage.setItem('beatdle-username', username);
      showToast(result.message);
      loadLeaderboard(); 
      return true;
    } else {
      showToast(result.message || 'Failed to submit score');
      return false;
    }
  } catch (error) {
    console.error('Error submitting score:', error);
    showToast('Failed to submit score. Check your API URL.');
    return false;
  }
}
async function deleteLeaderboardEntry(id) {
  const adminPasswordInput = document.getElementById('admin-password-input');
  const adminPassword = adminPasswordInput ? adminPasswordInput.value : '';
  if (!adminPassword) {
    showToast('Please enter admin password');
    return;
  }
  if (!confirm('Are you sure you want to delete this entry?')) {
    return;
  }
  try {
    const response = await fetch(`${LEADERBOARD_API_URL}/api/leaderboard/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ adminPassword })
    });
    const result = await response.json();
    if (result.success) {
      showToast('Entry deleted successfully');
      loadLeaderboard(); 
    } else {
      showToast(result.message || 'Failed to delete entry');
    }
  } catch (error) {
    console.error('Error deleting entry:', error);
    showToast('Failed to delete entry');
  }
}
function isAdminMode() {
  const adminPasswordInput = document.getElementById('admin-password-input');
  return adminPasswordInput && adminPasswordInput.value.length > 0;
}
function toggleAdminPanel() {
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) {
    const isVisible = adminPanel.style.display === 'block';
    adminPanel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      const adminPasswordInput = document.getElementById('admin-password-input');
      if (adminPasswordInput) {
        adminPasswordInput.focus();
      }
    }
  }
}
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
function onAdminPasswordChange() {
  updateLeaderboardDisplay();
}
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
function hideUsernamePrompt() {
  const usernamePrompt = document.getElementById('username-prompt');
  if (usernamePrompt) {
    usernamePrompt.style.display = 'none';
  }
}
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
