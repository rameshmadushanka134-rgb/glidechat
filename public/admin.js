let currentUser = null;
let allUsers = [];

// DOM Elements
const verifyOverlay = document.getElementById('verify-overlay');
const usersTableBody = document.getElementById('users-table-body');
const ticketsList = document.getElementById('tickets-list');
const usersCountDisplay = document.getElementById('users-count');
const supportCountBadge = document.getElementById('support-count-badge');
const userSearchInput = document.getElementById('user-search');

// Page Load Session Verification
document.addEventListener('DOMContentLoaded', async () => {
  const session = localStorage.getItem('user_session');
  if (!session) {
    redirectToMain();
    return;
  }

  try {
    currentUser = JSON.parse(session);
    if (!currentUser || !currentUser.token) {
      redirectToMain();
      return;
    }

    // Verify admin privileges with backend
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.token}`
      }
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      redirectToMain();
      return;
    }

    // Auth verification complete, hide overlay and load data
    verifyOverlay.style.display = 'none';
    
    // Set active tab to users initially
    switchTab('users');
    
    // Load dashboard datasets
    loadUsers();
    loadTickets();
  } catch (err) {
    console.error('Session verification error:', err);
    redirectToMain();
  }
});

function redirectToMain() {
  alert('Access denied. Redirecting to home...');
  window.location.href = '/index.html';
}

// TAB NAVIGATION SWITCHER
function switchTab(tabName) {
  // Reset tab button states
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  // Reset content sections visibility
  document.querySelectorAll('.admin-content-section').forEach(sec => {
    sec.classList.remove('active');
  });

  // Activate target tab & section
  document.getElementById(`tab-btn-${tabName}`).classList.add('active');
  document.getElementById(`section-${tabName}`).classList.add('active');
}

// --- USER MANAGEMENT LOGIC ---

async function loadUsers() {
  usersTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-secondary); padding: 2rem;">Loading users list...</td></tr>`;
  try {
    const res = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch users');

    allUsers = data;
    renderUsersList(allUsers);
  } catch (err) {
    usersTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: #ef4444; padding: 2rem;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading users: ${err.message}</td></tr>`;
  }
}

function renderUsersList(users) {
  usersCountDisplay.textContent = `Total Users: ${users.length}`;
  if (users.length === 0) {
    usersTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-secondary); padding: 3rem;">No users found matching search criteria.</td></tr>`;
    return;
  }

  usersTableBody.innerHTML = users.map(user => {
    const isSelf = user.username.toLowerCase() === currentUser.username.toLowerCase();
    
    // Avatar styling
    let avatarContent = '';
    if (user.avatarUrl) {
      avatarContent = `<img src="${user.avatarUrl}" alt="${user.username}">`;
    } else {
      avatarContent = user.username.charAt(0).toUpperCase();
    }

    // Action button
    const actionBtn = isSelf 
      ? `<span style="font-size: 0.8rem; color: var(--text-secondary); font-style: italic; font-weight: 500;">LoggedIn Admin</span>`
      : `<button class="btn btn-secondary btn-sm" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.35rem 0.75rem;" onclick="deleteUser('${user.username}')"><i class="fa-solid fa-trash-can"></i> Delete</button>`;

    return `
      <tr>
        <td>
          <div class="user-row-info">
            <div class="user-row-avatar">${avatarContent}</div>
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight: 600; font-size: 0.95rem;">${user.username}</span>
              ${user.incognito ? '<span style="font-size: 0.75rem; color: #10b981; font-weight:500;"><i class="fa-solid fa-eye-slash"></i> Incognito</span>' : ''}
            </div>
          </div>
        </td>
        <td style="color: var(--text-secondary); max-width: 300px; word-break: break-all;">
          ${user.bio ? escapeHtml(user.bio) : '<span style="font-style: italic; opacity:0.5;">No bio set</span>'}
        </td>
        <td>
          <span class="role-badge ${user.role}">${user.role}</span>
        </td>
        <td style="text-align: right;">
          ${actionBtn}
        </td>
      </tr>
    `;
  }).join('');
}

function filterUsers() {
  const query = userSearchInput.value.toLowerCase().trim();
  if (!query) {
    renderUsersList(allUsers);
    return;
  }

  const filtered = allUsers.filter(user => 
    user.username.toLowerCase().includes(query) || 
    (user.bio && user.bio.toLowerCase().includes(query))
  );
  renderUsersList(filtered);
}

async function deleteUser(username) {
  const confirmMsg = `Are you absolutely sure you want to completely delete the account for "${username}"?\n\nThis will permanently delete their profile, group memberships, and chat logs. This action CANNOT be undone.`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete user');

    alert(data.message || 'User deleted successfully.');
    
    // Reload users list
    loadUsers();
  } catch (err) {
    alert('Deletion Error: ' + err.message);
  }
}

// --- SUPPORT TICKETS LOGIC ---

async function loadTickets() {
  ticketsList.innerHTML = `<div class="empty-state">Loading support tickets...</div>`;
  try {
    const res = await fetch('/api/support/list', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch tickets');

    renderTicketsList(data);
  } catch (err) {
    ticketsList.innerHTML = `<div class="empty-state" style="color: #ef4444;"><i class="fa-solid fa-circle-exclamation"></i> Error loading tickets: ${err.message}</div>`;
  }
}

function renderTicketsList(tickets) {
  // Update badge
  if (tickets.length > 0) {
    supportCountBadge.textContent = tickets.length;
    supportCountBadge.classList.remove('hidden');
  } else {
    supportCountBadge.classList.add('hidden');
  }

  if (tickets.length === 0) {
    ticketsList.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-envelope-circle-check"></i>
        <h3>Inbox is Clean!</h3>
        <p>There are no unresolved user support tickets or feedback messages right now.</p>
      </div>
    `;
    return;
  }

  ticketsList.innerHTML = tickets.map(ticket => {
    const dateStr = new Date(ticket.timestamp).toLocaleString();
    return `
      <div class="ticket-card" id="ticket-${ticket.id}">
        <div class="ticket-header">
          <span class="ticket-sender"><i class="fa-solid fa-user-circle"></i> From: <strong>${ticket.sender}</strong></span>
          <span class="ticket-date">${dateStr}</span>
        </div>
        <div class="ticket-body">${escapeHtml(ticket.text)}</div>
        <div class="ticket-footer">
          <button class="btn btn-primary btn-sm" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); padding: 0.4rem 1rem;" onclick="resolveTicket('${ticket.id}')">
            <i class="fa-solid fa-check"></i> Mark Resolved
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function resolveTicket(ticketId) {
  try {
    const res = await fetch(`/api/support/${ticketId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resolve ticket');

    // Reload tickets
    loadTickets();
  } catch (err) {
    alert('Resolution Error: ' + err.message);
  }
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
