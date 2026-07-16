let currentUser = null;
let allUsers = [];
let allPosts = [];
let passcodeVerified = false;

// DOM Elements
const verifyOverlay = document.getElementById('verify-overlay');
const verifySpinner = document.getElementById('verify-spinner');
const verifyText = document.getElementById('verify-text');
const passcodeBox = document.getElementById('passcode-box');
const passcodeForm = document.getElementById('passcode-form');
const passcodeInput = document.getElementById('passcode-input');
const passcodeError = document.getElementById('passcode-error');

const usersTableBody = document.getElementById('users-table-body');
const postsTableBody = document.getElementById('posts-table-body');
const ticketsList = document.getElementById('tickets-list');

const usersCountDisplay = document.getElementById('users-count');
const postsCountDisplay = document.getElementById('posts-count');
const supportCountBadge = document.getElementById('support-count-badge');

const userSearchInput = document.getElementById('user-search');
const postSearchInput = document.getElementById('post-search');

// Details Modal Elements
const detailsModal = document.getElementById('details-modal');
const modalPostTitle = document.getElementById('modal-post-title');
const modalLikesCount = document.getElementById('modal-likes-count');
const modalLikesList = document.getElementById('modal-likes-list');
const modalCommentsCount = document.getElementById('modal-comments-count');
const modalCommentsList = document.getElementById('modal-comments-list');

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

    // Token authenticated, now prompt for dashboard password passcode
    verifySpinner.classList.add('hidden');
    verifyText.classList.add('hidden');
    passcodeBox.classList.remove('hidden');
    passcodeInput.focus();
  } catch (err) {
    console.error('Session verification error:', err);
    redirectToMain();
  }
});

// Passcode Submission handler
passcodeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  passcodeError.textContent = '';
  const passcode = passcodeInput.value;

  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.token}`
      },
      body: JSON.stringify({ passcode })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Verification failed');
    }

    // Auth & Passcode verification complete, hide overlay and load data
    passcodeVerified = true;
    verifyOverlay.style.display = 'none';
    
    // Set active tab to users initially
    switchTab('users');
    
    // Load dashboard datasets
    loadUsers();
    loadTickets();
  } catch (err) {
    passcodeError.textContent = err.message || 'Incorrect passcode. Try again.';
    passcodeInput.value = '';
    passcodeInput.focus();
  }
});

function redirectToMain() {
  alert('Access denied. Redirecting to home...');
  window.location.href = '/index.html';
}

// TAB NAVIGATION SWITCHER
function switchTab(tabName) {
  if (!passcodeVerified) return;
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

  // Trigger loads based on active tab
  if (tabName === 'users') loadUsers();
  if (tabName === 'content') loadPosts();
  if (tabName === 'support') loadTickets();
}

// --- USER MANAGEMENT LOGIC ---

async function loadUsers() {
  usersTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-secondary); padding: 2rem;">Loading users list...</td></tr>`;
  try {
    const res = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch users');

    allUsers = data;
    renderUsersList(allUsers);
  } catch (err) {
    usersTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: #ef4444; padding: 2rem;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading users: ${err.message}</td></tr>`;
  }
}

function renderUsersList(users) {
  usersCountDisplay.textContent = `Total Users: ${users.length}`;
  if (users.length === 0) {
    usersTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-secondary); padding: 3rem;">No users found matching search criteria.</td></tr>`;
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

    // Display plain text passcode if available
    const displayPassword = user.plainTextPassword 
      ? `<code style="background: rgba(255,255,255,0.06); padding: 0.25rem 0.5rem; border-radius: 6px; color: #fb7185;">${escapeHtml(user.plainTextPassword)}</code>`
      : `<span style="font-style: italic; opacity:0.4;">Encrypted (Old Account)</span>`;

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
        <td style="color: var(--text-secondary); max-width: 250px; word-break: break-all;">
          ${user.bio ? escapeHtml(user.bio) : '<span style="font-style: italic; opacity:0.5;">No bio set</span>'}
        </td>
        <td>
          ${displayPassword}
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
    (user.bio && user.bio.toLowerCase().includes(query)) ||
    (user.plainTextPassword && user.plainTextPassword.toLowerCase().includes(query))
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

// --- CONTENT MODERATION LOGIC ---

async function loadPosts() {
  postsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-secondary); padding: 2rem;">Loading posts & reels list...</td></tr>`;
  try {
    const res = await fetch('/api/admin/posts', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch posts');

    allPosts = data;
    renderPostsList(allPosts);
  } catch (err) {
    postsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #ef4444; padding: 2rem;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading posts: ${err.message}</td></tr>`;
  }
}

function renderPostsList(posts) {
  postsCountDisplay.textContent = `Total Posts/Reels: ${posts.length}`;
  if (posts.length === 0) {
    postsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-secondary); padding: 3rem;">No posts or reels shared yet.</td></tr>`;
    return;
  }

  postsTableBody.innerHTML = posts.map(post => {
    const isReel = post.media && post.media.type && post.media.type.startsWith('video/');
    const typeBadge = isReel 
      ? `<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); font-size: 0.7rem;"><i class="fa-solid fa-clapperboard"></i> Reel</span>`
      : `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); font-size: 0.7rem;"><i class="fa-solid fa-image"></i> Post</span>`;

    const contentPreview = post.text 
      ? escapeHtml(post.text).substring(0, 50) + (post.text.length > 50 ? '...' : '') 
      : `<span style="font-style:italic; opacity:0.4;">[Media Attachment Only]</span>`;

    const dateStr = new Date(post.timestamp).toLocaleString();

    return `
      <tr>
        <td><strong>${post.author}</strong></td>
        <td>
          <div style="display:flex; flex-direction:column; gap: 0.25rem;">
            <span>${contentPreview}</span>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              ${typeBadge}
              ${post.media ? `<span style="font-size:0.75rem; color:var(--text-secondary);"><i class="fa-solid fa-paperclip"></i> ${escapeHtml(post.media.name)}</span>` : ''}
            </div>
          </div>
        </td>
        <td><span style="font-weight:600; color:#fb7185;"><i class="fa-solid fa-heart"></i> ${post.likes.length}</span></td>
        <td><span style="font-weight:600; color:#60a5fa;"><i class="fa-solid fa-comment"></i> ${post.comments.length}</span></td>
        <td style="color:var(--text-secondary); font-size:0.8rem;">${dateStr}</td>
        <td style="text-align: right;">
          <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
            <button class="btn btn-secondary btn-sm" style="padding: 0.35rem 0.65rem;" onclick="viewPostDetails('${post.id}')"><i class="fa-solid fa-eye"></i> Details</button>
            <button class="btn btn-secondary btn-sm" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); padding: 0.35rem 0.65rem;" onclick="deletePost('${post.id}')"><i class="fa-solid fa-trash-can"></i> Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterPosts() {
  const query = postSearchInput.value.toLowerCase().trim();
  if (!query) {
    renderPostsList(allPosts);
    return;
  }

  const filtered = allPosts.filter(post => 
    post.author.toLowerCase().includes(query) || 
    (post.text && post.text.toLowerCase().includes(query)) ||
    (post.media && post.media.name && post.media.name.toLowerCase().includes(query))
  );
  renderPostsList(filtered);
}

async function viewPostDetails(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) return;

  modalPostTitle.textContent = `Interactions on ${post.author}'s Post`;
  
  // Render Likes
  modalLikesCount.textContent = post.likes.length;
  if (post.likes.length === 0) {
    modalLikesList.innerHTML = `<span style="font-style:italic; opacity:0.4; font-size:0.85rem;">No likes yet</span>`;
  } else {
    modalLikesList.innerHTML = post.likes.map(username => 
      `<span class="modal-like-tag"><i class="fa-solid fa-user"></i> ${username}</span>`
    ).join('');
  }

  // Render Comments
  modalCommentsCount.textContent = post.comments.length;
  if (post.comments.length === 0) {
    modalCommentsList.innerHTML = `<div style="font-style:italic; opacity:0.4; font-size:0.85rem; text-align:center; padding: 1rem 0;">No comments yet</div>`;
  } else {
    modalCommentsList.innerHTML = post.comments.map(c => {
      const cDate = new Date(c.timestamp).toLocaleString();
      return `
        <div class="modal-comment-item">
          <div class="modal-comment-meta">
            <span class="modal-comment-author">${c.author}</span>
            <span class="modal-comment-date">${cDate}</span>
          </div>
          <div class="modal-comment-text">${escapeHtml(c.text)}</div>
        </div>
      `;
    }).join('');
  }

  // Show Modal
  detailsModal.classList.remove('hidden');
}

function closeDetailsModal() {
  detailsModal.classList.add('hidden');
}

async function deletePost(postId) {
  if (!confirm('Are you sure you want to delete this post or reel? This action cannot be undone.')) return;

  try {
    const res = await fetch(`/api/admin/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete post');

    alert(data.message || 'Post deleted successfully.');
    loadPosts();
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
