const LEADERBOARD_API_URL = 'https://leaderboard-saber.onrender.com';
const API_TIMEOUT = 5000;

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

// Fetch with timeout
function fetchWithTimeout(url, options = {}, timeout = API_TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
}

// Load leaderboard from API
async function loadLeaderboard() {
  const leaderboardList = document.getElementById('leaderboard-list');
  
  if (leaderboardList) {
    leaderboardList.innerHTML = '<div class="leaderboard-loading">Loading leaderboard...</div>';
  }
  
  try {
    const response = await fetchWithTimeout(`${LEADERBOARD_API_URL}/api/leaderboard`);
    const result = await response.json();
    
    if (result.success && result.data) {
      leaderboardData = Array.isArray(result.data) ? result.data : [];
      updateLeaderboardDisplay();
    } else {
      if (leaderboardList) {
        leaderboardList.innerHTML = '<div class="leaderboard-error">Unable to load leaderboard. Please try again later.</div>';
      }
    }
  } catch (error) {
    if (leaderboardList) {
      leaderboardList.innerHTML = '<div class="leaderboard-error">Connection timeout. Leaderboard unavailable.</div>';
    }
  }
}

// Update leaderboard display
function updateLeaderboardDisplay() {
  const leaderboardList = document.getElementById('leaderboard-list');
  if (!leaderboardList) return;
  
  leaderboardList.innerHTML = '';
  
  if (!leaderboardData || leaderboardData.length === 0) {
    leaderboardList.innerHTML = '<div class="leaderboard-empty">No scores yet. Be the first!</div>';
    return;
  }
  
  leaderboardData.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';
    
    if (entry.username && entry.username.toLowerCase() === currentUsername.toLowerCase()) {
      row.classList.add('current-user');
    }
    
    let medal = '';
    if (index === 0) medal = '🥇';
    else if (index === 1) medal = '🥈';
    else if (index === 2) medal = '🥉';
    
    const dateStr = entry.date ? new Date(entry.date).toLocaleDateString() : 'N/A';
    
    row.innerHTML = `
      <span class="leaderboard-rank">${medal || `#${index + 1}`}</span>
      <span class="leaderboard-username">${escapeHtml(entry.username || 'Unknown')}</span>
      <span class="leaderboard-score">${entry.score || 0}</span>
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

// Submit score to leaderboard
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
    // SECURITY: Send request with current timestamp
    // Server validates timestamp is recent (prevents replay attacks)
    const timestamp = Date.now().toString();
    
    const response = await fetchWithTimeout(`${LEADERBOARD_API_URL}/api/leaderboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        username, 
        score,
        timestamp  // Server validates this is within 5 minutes
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      currentUsername = username;
      localStorage.setItem('beatdle-username', username);
      showToast(result.message || 'Score submitted!');
      loadLeaderboard();
      return true;
    } else {
      showToast(result.message || 'Failed to submit score');
      console.error('Score submission failed:', result.message);
      return false;
    }
  } catch (error) {
    showToast('Connection error. Please try again.');
    console.error('Leaderboard submission error:', error);
    return false;
  }
}

// Delete leaderboard entry (admin only)
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
    const timestamp = Date.now().toString();
    
    const response = await fetchWithTimeout(`${LEADERBOARD_API_URL}/api/leaderboard/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        adminPassword,
        timestamp
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('Entry deleted successfully');
      loadLeaderboard();
    } else {
      showToast(result.message || 'Failed to delete entry');
    }
  } catch (error) {
    showToast('Connection error. Delete failed.');
  }
}

// Check if admin mode is active
function isAdminMode() {
  const adminPasswordInput = document.getElementById('admin-password-input');
  return adminPasswordInput && adminPasswordInput.value.length > 0;
}

// Toggle admin panel
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

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update leaderboard when admin password is entered
function onAdminPasswordChange() {
  updateLeaderboardDisplay();
}

// Show username prompt when game ends in infinite mode
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

// Export functions for use in main.js
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
