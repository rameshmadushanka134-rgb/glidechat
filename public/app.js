// Socket connection instance
let socket;

// Application State
let currentUser = null;
let activeChat = null; // 'group', a username, or null if no active chat
let registeredUsers = [];
const unreadCounts = new Map();
const typingTimers = new Map();

// Local settings configurations
let soundEnabled = true;
let activeTheme = 'purple';

// Status / Stories State
let statusFeed = {}; // grouped by username: { username, avatarUrl, stories: [...] }
let selectedStatusGradient = 'bg-gradient-1';
let activeStoryUser = null;
let activeStoryIndex = 0;
let storyTimer = null;
const storyDuration = 5000; // 5 seconds per slide
let storyProgressInterval = null;

// WebRTC Calling State
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let callType = null; // 'voice' or 'video'
let isCallInitiator = false;
let callActive = false;
let currentCallUser = null;
let callTimerInterval = null;
let callStartTime = null;
let remoteIceCandidatesQueue = [];

// Ice Server Configuration for Peer Connections
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Audio Alert Synthesizer Contexts (Web Audio API)
let audioCtx = null;
let ringtoneInterval = null;
let ringtoneGain = null;
let isRingtonePlaying = false;

// Load stored user session if exists
const storedUser = localStorage.getItem('user_session');
if (storedUser) {
  try {
    currentUser = JSON.parse(storedUser);
  } catch (e) {
    localStorage.removeItem('user_session');
  }
}

// Load local settings
const storedSound = localStorage.getItem('chat_sound_enabled');
if (storedSound !== null) {
  soundEnabled = storedSound === 'true';
}

const storedTheme = localStorage.getItem('chat_theme');
if (storedTheme) {
  activeTheme = storedTheme;
}

// DOM Elements
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const currentUserDisplay = document.getElementById('current-user-display');
const currentUserAvatar = document.getElementById('current-user-avatar');
const usersList = document.getElementById('users-list');
const messagesDisplay = document.getElementById('messages-display');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const activeChatTitle = document.getElementById('active-chat-title');
const activeChatStatus = document.getElementById('active-chat-status');
const activeChatAvatar = document.getElementById('active-chat-avatar');
const typingIndicatorBox = document.getElementById('typing-indicator-box');
const typingIndicatorText = document.getElementById('typing-indicator-text');
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');
const logoutBtn = document.getElementById('logout-btn');
const mobileBackBtn = document.getElementById('mobile-back-btn');
const searchUsersInput = document.getElementById('search-users');

// Settings Modal Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const profileSettingsForm = document.getElementById('profile-settings-form');
const passwordSettingsForm = document.getElementById('password-settings-form');
const settingsBio = document.getElementById('settings-bio');
const passwordOld = document.getElementById('settings-old-password');
const passwordNew = document.getElementById('settings-new-password');
const passwordError = document.getElementById('password-settings-error');
const passwordSuccess = document.getElementById('password-settings-success');
const soundToggle = document.getElementById('settings-sound-toggle');
const incognitoToggle = document.getElementById('settings-incognito-toggle');
const blockedUsersList = document.getElementById('blocked-users-list');

// File Attachment & Avatar Elements
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');
const avatarInput = document.getElementById('avatar-input');
const uploadAvatarBtn = document.getElementById('upload-avatar-btn');
const settingsAvatarPreview = document.getElementById('settings-avatar-preview');

// Status Modal & Viewer Elements
const statusTray = document.getElementById('status-tray');
const postStatusBtn = document.getElementById('post-status-btn');
const statusUploadModal = document.getElementById('status-upload-modal');
const closeStatusUploadBtn = document.getElementById('close-status-upload-btn');
const textStatusForm = document.getElementById('text-status-form');
const statusTextInput = document.getElementById('status-text-input');
const statusImageInput = document.getElementById('status-image-input');
const selectStatusImageBtn = document.getElementById('select-status-image-btn');

const statusViewerModal = document.getElementById('status-viewer-modal');
const storyProgressContainer = document.getElementById('story-progress-container');
const storyAuthorAvatar = document.getElementById('story-author-avatar');
const storyAuthorName = document.getElementById('story-author-name');
const storyTimeLabel = document.getElementById('story-time-label');
const storyStage = document.getElementById('story-stage');
const closeStoryViewerBtn = document.getElementById('close-story-viewer-btn');
const deleteStoryBtn = document.getElementById('delete-story-btn');
const storyTapLeft = document.getElementById('story-tap-left');
const storyTapRight = document.getElementById('story-tap-right');

// Chat Header Actions Buttons
const headerClearBtn = document.getElementById('header-clear-btn');
const headerBlockBtn = document.getElementById('header-block-btn');
const headerVoiceCallBtn = document.getElementById('header-voice-call-btn');
const headerVideoCallBtn = document.getElementById('header-video-call-btn');

// Call Overlay Elements
const callOverlay = document.getElementById('call-overlay');
const callAvatarBox = document.getElementById('call-avatar-box');
const callUsername = document.getElementById('call-username');
const callStatus = document.getElementById('call-status');
const callVideoContainer = document.getElementById('call-video-container');
const remoteVideo = document.getElementById('remote-video');
const localVideo = document.getElementById('local-video');
const incomingCallControls = document.getElementById('incoming-call-controls');
const activeCallControls = document.getElementById('active-call-controls');
const answerCallBtn = document.getElementById('answer-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');
const muteMicBtn = document.getElementById('mute-mic-btn');
const toggleVideoBtn = document.getElementById('toggle-video-btn');
const hangupCallBtn = document.getElementById('hangup-call-btn');

// Group Elements
const createGroupBtn = document.getElementById('create-group-btn');
const groupCreateModal = document.getElementById('group-create-modal');
const closeGroupCreateBtn = document.getElementById('close-group-create-btn');
const groupCreateForm = document.getElementById('group-create-form');
const groupNameInput = document.getElementById('group-name-input');
const groupMembersSelectList = document.getElementById('group-members-select-list');
const groupCreateError = document.getElementById('group-create-error');

const headerGroupInfoBtn = document.getElementById('header-group-info-btn');
const groupInfoModal = document.getElementById('group-info-modal');
const closeGroupInfoBtn = document.getElementById('close-group-info-btn');
const groupInfoName = document.getElementById('group-info-name');
const groupInfoMeta = document.getElementById('group-info-meta');
const groupInfoMembersList = document.getElementById('group-info-members-list');
const groupInfoAddMemberSection = document.getElementById('group-info-add-member-section');
const groupInfoAddMemberSelect = document.getElementById('group-info-add-member-select');
const groupInfoAddMemberBtn = document.getElementById('group-info-add-member-btn');
const groupLeaveBtn = document.getElementById('group-leave-btn');
const groupDeleteBtn = document.getElementById('group-delete-btn');

const roomsList = document.getElementById('rooms-list');

// News Feed Elements
const navChatsBtn = document.getElementById('nav-chats-btn');
const navFeedBtn = document.getElementById('nav-feed-btn');
const feedMain = document.getElementById('feed-main');
const chatMain = document.getElementById('chat-main');

const mobileBackFeedBtn = document.getElementById('mobile-back-feed-btn');
const feedFilterAllBtn = document.getElementById('feed-filter-all-btn');
const feedFilterReelsBtn = document.getElementById('feed-filter-reels-btn');

const feedComposerAvatar = document.getElementById('feed-composer-avatar');
const feedComposerText = document.getElementById('feed-composer-text');
const feedComposerSubmitBtn = document.getElementById('feed-composer-submit-btn');
const feedComposerFileBtn = document.getElementById('feed-composer-file-btn');
const feedComposerFileInput = document.getElementById('feed-composer-file-input');
const feedComposerPreviewContainer = document.getElementById('feed-composer-preview-container');
const feedComposerRemoveMediaBtn = document.getElementById('feed-composer-remove-media-btn');
const feedComposerImgPreview = document.getElementById('feed-composer-img-preview');
const feedComposerVideoPreview = document.getElementById('feed-composer-video-preview');

const feedPostsDisplay = document.getElementById('feed-posts-display');

// News Feed Search and User Profile Elements
const feedSearchInput = document.getElementById('feed-search-input');
const feedSearchClearBtn = document.getElementById('feed-search-clear-btn');
const feedPeopleTray = document.getElementById('feed-people-tray');
const feedPeopleList = document.getElementById('feed-people-list');

const userProfileModal = document.getElementById('user-profile-modal');
const closeProfileModalBtn = document.getElementById('close-profile-modal-btn');
const profileModalAvatarContainer = document.getElementById('profile-modal-avatar-container');
const profileModalUsername = document.getElementById('profile-modal-username');
const profileModalStatusBadge = document.getElementById('profile-modal-status-badge');
const profileModalBio = document.getElementById('profile-modal-bio');
const profileActionMsgBtn = document.getElementById('profile-action-msg-btn');
const profileActionBlockBtn = document.getElementById('profile-action-block-btn');
const profilePostsList = document.getElementById('profile-posts-list');

let myGroups = [];
let postsFeed = [];
let activeFeedTab = 'all'; // 'all' or 'reels'
let composerAttachedFile = null;
let activeProfileUsername = null;
let searchQuery = '';

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  setTheme(activeTheme);

  if (currentUser) {
    showChatWorkspace();
  } else {
    showAuthScreen();
  }

  // Setup form submission listeners
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  messageForm.addEventListener('submit', handleSendMessage);
  
  // Mobile Back Button
  mobileBackBtn.addEventListener('click', () => {
    chatContainer.classList.remove('active-chat');
  });

  // Logout Button
  logoutBtn.addEventListener('click', logout);

  // Search filter for user contacts
  searchUsersInput.addEventListener('input', renderUsersList);

  // Emoji Popover toggle
  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('hidden');
  });

  // Hide emoji picker and open message menus when clicking outside
  document.addEventListener('click', () => {
    emojiPicker.classList.add('hidden');
    document.querySelectorAll('.message-options-menu').forEach(menu => {
      menu.classList.add('hidden');
    });
  });

  // Socket typing notification listener
  let localTypingTimeout;
  messageInput.addEventListener('input', () => {
    if (!socket || !currentUser) return;

    socket.emit('typing', { to: activeChat, isTyping: true });

    clearTimeout(localTypingTimeout);
    localTypingTimeout = setTimeout(() => {
      socket.emit('typing', { to: activeChat, isTyping: false });
    }, 1500);
  });

  // --- ATTACHMENT ACTION LISTENERS ---
  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileAttachmentUpload);

  // --- SETTINGS DP LISTENERS ---
  uploadAvatarBtn.addEventListener('click', () => avatarInput.click());
  avatarInput.addEventListener('change', handleAvatarUpload);

  // --- SETTINGS MODAL LISTENERS ---
  settingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  profileSettingsForm.addEventListener('submit', handleProfileUpdate);
  passwordSettingsForm.addEventListener('submit', handlePasswordUpdate);

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  soundToggle.checked = soundEnabled;
  soundToggle.addEventListener('change', (e) => {
    soundEnabled = e.target.checked;
    localStorage.setItem('chat_sound_enabled', soundEnabled);
  });

  incognitoToggle.addEventListener('change', handleIncognitoToggle);

  // --- WHATSAPP STATUS LISTENERS ---
  postStatusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openStatusCreator();
  });
  closeStatusUploadBtn.addEventListener('click', closeStatusCreator);
  textStatusForm.addEventListener('submit', handleTextStatusSubmit);
  selectStatusImageBtn.addEventListener('click', () => statusImageInput.click());
  statusImageInput.addEventListener('change', handleImageStatusSubmit);
  
  statusUploadModal.addEventListener('click', (e) => {
    if (e.target === statusUploadModal) closeStatusCreator();
  });

  closeStoryViewerBtn.addEventListener('click', closeStoryViewer);
  deleteStoryBtn.addEventListener('click', handleDeleteActiveStory);
  storyTapLeft.addEventListener('click', playPreviousStorySlide);
  storyTapRight.addEventListener('click', playNextStorySlide);

  // --- CHAT HEADER ACTIONS ---
  headerClearBtn.addEventListener('click', handleClearChat);
  headerBlockBtn.addEventListener('click', () => {
    if (activeChat === 'group') return;
    const isBlocked = currentUser.blockedUsers && currentUser.blockedUsers.some(
      u => u.toLowerCase() === activeChat.toLowerCase()
    );
    const action = isBlocked ? 'unblock' : 'block';
    const confirmMsg = isBlocked 
      ? `Are you sure you want to unblock ${activeChat}?`
      : `Are you sure you want to block ${activeChat}? Blocked users cannot message you.`;
      
    if (confirm(confirmMsg)) {
      toggleBlockUser(activeChat, action);
    }
  });

  // --- CALLING ACTION LISTENERS ---
  headerVoiceCallBtn.addEventListener('click', () => initiateCall('voice'));
  headerVideoCallBtn.addEventListener('click', () => initiateCall('video'));
  answerCallBtn.addEventListener('click', handleAnswerCall);
  rejectCallBtn.addEventListener('click', handleRejectCall);
  hangupCallBtn.addEventListener('click', handleHangUpCall);
  muteMicBtn.addEventListener('click', toggleMuteMic);
  toggleVideoBtn.addEventListener('click', toggleMuteVideo);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeStoryViewer();
      closeSettings();
      closeStatusCreator();
      closeGroupCreator();
      closeGroupSettings();
      closeUserProfileModal();
      if (callActive && !localStream) {
        handleRejectCall();
      }
    }
  });

  // --- CUSTOM GROUPS LISTENERS ---
  createGroupBtn.addEventListener('click', openGroupCreator);
  closeGroupCreateBtn.addEventListener('click', closeGroupCreator);
  groupCreateForm.addEventListener('submit', handleGroupCreateSubmit);
  
  headerGroupInfoBtn.addEventListener('click', openGroupSettings);
  closeGroupInfoBtn.addEventListener('click', closeGroupSettings);
  
  groupLeaveBtn.addEventListener('click', () => handleGroupAdminAction('leave'));
  groupDeleteBtn.addEventListener('click', () => handleGroupAdminAction('delete_group'));
  
  groupInfoAddMemberBtn.addEventListener('click', () => {
    const targetUsername = groupInfoAddMemberSelect.value;
    if (targetUsername) {
      handleGroupAdminAction('add_member', targetUsername);
    }
  });

  groupCreateModal.addEventListener('click', (e) => {
    if (e.target === groupCreateModal) closeGroupCreator();
  });
  groupInfoModal.addEventListener('click', (e) => {
    if (e.target === groupInfoModal) closeGroupSettings();
  });

  // --- NEWS FEED NAVIGATION LISTENERS ---
  navChatsBtn.addEventListener('click', () => {
    switchSidebarNav('chats');
  });
  navFeedBtn.addEventListener('click', () => {
    switchSidebarNav('feed');
  });
  mobileBackFeedBtn.addEventListener('click', () => {
    chatContainer.classList.remove('active-chat');
  });

  // Filter Buttons
  feedFilterAllBtn.addEventListener('click', () => {
    switchFeedTab('all');
  });
  feedFilterReelsBtn.addEventListener('click', () => {
    switchFeedTab('reels');
  });

  // Composer listeners
  feedComposerFileBtn.addEventListener('click', () => feedComposerFileInput.click());
  feedComposerFileInput.addEventListener('change', handleFeedMediaPreselect);
  feedComposerRemoveMediaBtn.addEventListener('click', clearFeedComposerMedia);
  feedComposerSubmitBtn.addEventListener('click', handleFeedPostSubmit);

  // Search & Profile Modal listeners
  feedSearchInput.addEventListener('input', handleFeedSearchInput);
  feedSearchClearBtn.addEventListener('click', clearFeedSearch);
  
  closeProfileModalBtn.addEventListener('click', closeUserProfileModal);
  profileActionMsgBtn.addEventListener('click', handleProfileMsgAction);
  profileActionBlockBtn.addEventListener('click', handleProfileBlockAction);
});

/* --- UI SCREEN CONTROLLERS --- */
function showAuthScreen() {
  authContainer.classList.remove('hidden');
  chatContainer.classList.add('hidden');
  if (socket) {
    socket.disconnect();
  }
}

function showChatWorkspace() {
  authContainer.classList.add('hidden');
  chatContainer.classList.remove('hidden');

  currentUserDisplay.textContent = currentUser.username;
  updateAvatarDisplay(currentUserAvatar, currentUser.username, currentUser.avatarUrl);

  settingsBio.value = currentUser.bio || '';
  incognitoToggle.checked = !!currentUser.incognito;
  updateAvatarDisplay(settingsAvatarPreview, currentUser.username, currentUser.avatarUrl);

  initSocket();
  fetchUsers();
  fetchGroups();
  // Do not select any chat by default so the dashboard/sidebar opens first
  // selectChat('group');
  chatContainer.classList.add('no-active-chat'); 
  fetchStatuses();

  // Request notification permissions and register service worker subscription
  initPushNotifications();
}

function switchForm(formType) {
  loginError.textContent = '';
  registerError.textContent = '';
  loginForm.reset();
  registerForm.reset();

  if (formType === 'login') {
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
  } else {
    loginForm.classList.remove('active');
    registerForm.classList.add('active');
  }
}

function updateAvatarDisplay(element, username, avatarUrl) {
  if (!element) return;
  
  if (avatarUrl) {
    element.innerHTML = `<img src="${avatarUrl}" alt="${username}">`;
  } else {
    element.textContent = username.charAt(0).toUpperCase();
  }
}

/* --- API HANDLERS (AUTH) --- */
async function handleLogin(e) {
  e.preventDefault();
  loginError.textContent = '';

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    currentUser = data;
    localStorage.setItem('user_session', JSON.stringify(currentUser));
    loginForm.reset();
    showChatWorkspace();
  } catch (err) {
    loginError.textContent = err.message;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  registerError.textContent = '';

  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;

  if (password !== confirmPassword) {
    registerError.textContent = 'Passwords do not match';
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    alert('Account created! Please log in.');
    switchForm('login');
  } catch (err) {
    registerError.textContent = err.message;
  }
}

function logout() {
  localStorage.removeItem('user_session');
  currentUser = null;
  showAuthScreen();
}

/* --- SETTINGS HANDLERS --- */
function openSettings() {
  settingsBio.value = currentUser.bio || '';
  incognitoToggle.checked = !!currentUser.incognito;
  updateAvatarDisplay(settingsAvatarPreview, currentUser.username, currentUser.avatarUrl);
  
  passwordOld.value = '';
  passwordNew.value = '';
  passwordError.textContent = '';
  passwordSuccess.textContent = '';
  
  renderBlockedList();
  switchSettingsTab('account');
  settingsModal.classList.remove('hidden');
  updatePushSettingsUI();
}

function closeSettings() {
  settingsModal.classList.add('hidden');
}

function switchSettingsTab(tabName) {
  document.querySelectorAll('.modal-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.getElementById(`tab-nav-${tabName}`).classList.add('active');

  document.querySelectorAll('.settings-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`settings-tab-${tabName}`).classList.add('active');
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  
  const bio = settingsBio.value.trim();
  
  try {
    const res = await fetch('/api/settings/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username, bio })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update profile');
    }

    currentUser.bio = data.bio;
    localStorage.setItem('user_session', JSON.stringify(currentUser));
    
    alert('Profile updated successfully!');
    closeSettings();
    fetchUsers();
  } catch (err) {
    alert('Error updating profile: ' + err.message);
  }
}

async function handlePasswordUpdate(e) {
  e.preventDefault();
  passwordError.textContent = '';
  passwordSuccess.textContent = '';

  const oldPassword = passwordOld.value;
  const newPassword = passwordNew.value;

  try {
    const res = await fetch('/api/settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username, oldPassword, newPassword })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update password');
    }

    passwordSuccess.textContent = 'Password changed successfully!';
    passwordOld.value = '';
    passwordNew.value = '';
  } catch (err) {
    passwordError.textContent = err.message;
  }
}

async function handleIncognitoToggle(e) {
  const incognito = e.target.checked;

  try {
    const res = await fetch('/api/settings/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username, incognito })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to sync incognito mode');
    }

    currentUser.incognito = data.incognito;
    localStorage.setItem('user_session', JSON.stringify(currentUser));
    
    if (socket) {
      socket.disconnect();
      initSocket();
    }
  } catch (err) {
    alert('Error toggling incognito status: ' + err.message);
    e.target.checked = !incognito;
  }
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);
  formData.append('username', currentUser.username);

  try {
    uploadAvatarBtn.disabled = true;
    uploadAvatarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

    const res = await fetch('/api/settings/avatar', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload image');
    }

    currentUser.avatarUrl = data.avatarUrl;
    localStorage.setItem('user_session', JSON.stringify(currentUser));

    updateAvatarDisplay(settingsAvatarPreview, currentUser.username, currentUser.avatarUrl);
    updateAvatarDisplay(currentUserAvatar, currentUser.username, currentUser.avatarUrl);
    
    fetchUsers();
    fetchStatuses();

    if (socket) {
      socket.emit('authenticate', { username: currentUser.username });
    }

    alert('Profile picture updated successfully!');
  } catch (err) {
    alert('Error uploading avatar: ' + err.message);
  } finally {
    uploadAvatarBtn.disabled = false;
    uploadAvatarBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Change Photo';
    avatarInput.value = '';
  }
}

/* --- ATTACHMENTS --- */
async function handleFileAttachmentUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    messageInput.placeholder = 'Uploading attachment...';
    messageInput.disabled = true;
    attachBtn.disabled = true;
    attachBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const fileMeta = await res.json();
    if (!res.ok) {
      throw new Error(fileMeta.error || 'Failed to upload file');
    }

    const payload = {
      text: `Shared a file: ${fileMeta.name}`,
      file: {
        url: fileMeta.url,
        name: fileMeta.name,
        type: fileMeta.type,
        size: fileMeta.size
      }
    };

    if (activeChat === 'group' || activeChat.startsWith('group_')) {
      payload.to = activeChat;
      socket.emit('group_message', payload);
    } else {
      payload.to = activeChat;
      socket.emit('private_message', payload);
    }
  } catch (err) {
    alert('Failed to send file: ' + err.message);
  } finally {
    messageInput.placeholder = 'Type a message...';
    messageInput.disabled = false;
    attachBtn.disabled = false;
    attachBtn.innerHTML = '<i class="fa-solid fa-paperclip"></i>';
    fileInput.value = '';
    messageInput.focus();
  }
}

function setTheme(theme) {
  activeTheme = theme;
  document.body.className = `theme-${theme}`;
  localStorage.setItem('chat_theme', theme);

  document.querySelectorAll('.theme-preset-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`theme-btn-${theme}`);
  if (activeBtn) activeBtn.classList.add('active');
}

async function toggleBlockUser(targetUsername, action) {
  try {
    const res = await fetch('/api/settings/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username, targetUsername, action })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Failed to ${action} user`);
    }

    currentUser.blockedUsers = data.blockedUsers || [];
    localStorage.setItem('user_session', JSON.stringify(currentUser));

    renderBlockedList();
    renderUsersList();
    fetchStatuses();
    
    if (activeChat && activeChat.toLowerCase() === targetUsername.toLowerCase()) {
      updateHeaderBlockButton(targetUsername);
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function renderBlockedList() {
  blockedUsersList.innerHTML = '';
  const blocked = currentUser.blockedUsers || [];

  if (blocked.length === 0) {
    blockedUsersList.innerHTML = `<li class="no-blocked-users">No blocked contacts yet</li>`;
    return;
  }

  blocked.forEach(username => {
    const li = document.createElement('li');
    li.className = 'blocked-item';
    li.innerHTML = `
      <span class="blocked-name">${username}</span>
      <button class="btn-unblock" onclick="toggleBlockUser('${username}', 'unblock')">Unblock</button>
    `;
    blockedUsersList.appendChild(li);
  });
}

function updateHeaderBlockButton(target) {
  if (target === 'group') {
    headerBlockBtn.classList.add('hidden');
    return;
  }

  headerBlockBtn.classList.remove('hidden');
  
  const isBlocked = currentUser.blockedUsers && currentUser.blockedUsers.some(
    u => u.toLowerCase() === target.toLowerCase()
  );

  if (isBlocked) {
    headerBlockBtn.innerHTML = '<i class="fa-solid fa-user-check" style="color: var(--status-online)"></i>';
    headerBlockBtn.title = 'Unblock Contact';
  } else {
    headerBlockBtn.innerHTML = '<i class="fa-solid fa-user-slash" style="color: var(--text-muted)"></i>';
    headerBlockBtn.title = 'Block Contact';
  }
}

/* --- WHATSAPP STATUS (STORIES) LOGIC --- */
function openStatusCreator() {
  statusTextInput.value = '';
  statusImageInput.value = '';
  switchStatusUploadTab('text');
  statusUploadModal.classList.remove('hidden');
}

function closeStatusCreator() {
  statusUploadModal.classList.add('hidden');
}

function switchStatusUploadTab(tabType) {
  const textBtn = document.getElementById('status-tab-btn-text');
  const imgBtn = document.getElementById('status-tab-btn-image');
  const textSec = document.getElementById('status-upload-text-sec');
  const imgSec = document.getElementById('status-upload-image-sec');

  if (tabType === 'text') {
    textBtn.className = 'btn btn-sm btn-primary';
    imgBtn.className = 'btn btn-sm';
    imgBtn.style.background = 'rgba(255,255,255,0.04)';
    imgBtn.style.border = '1px solid var(--border-color)';
    
    textSec.classList.remove('hidden');
    imgSec.classList.add('hidden');
  } else {
    imgBtn.className = 'btn btn-sm btn-primary';
    textBtn.className = 'btn btn-sm';
    textBtn.style.background = 'rgba(255,255,255,0.04)';
    textBtn.style.border = '1px solid var(--border-color)';
    
    imgSec.classList.remove('hidden');
    textSec.classList.add('hidden');
  }
}

function selectStatusGradient(index) {
  selectedStatusGradient = `bg-gradient-${index}`;
  
  for (let i = 1; i <= 4; i++) {
    const btn = document.getElementById(`grad-btn-${i}`);
    if (i === index) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
}

async function handleTextStatusSubmit(e) {
  e.preventDefault();
  const text = statusTextInput.value.trim();
  if (!text) return;

  try {
    const res = await fetch('/api/status/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser.username,
        text,
        bgGradient: selectedStatusGradient
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to post text status');
    }

    closeStatusCreator();
    fetchStatuses();
  } catch (err) {
    alert('Error posting status: ' + err.message);
  }
}

async function handleImageStatusSubmit(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('username', currentUser.username);

  try {
    selectStatusImageBtn.disabled = true;
    selectStatusImageBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

    const res = await fetch('/api/status/image', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to post image status');
    }

    closeStatusCreator();
    fetchStatuses();
  } catch (err) {
    alert('Error uploading status photo: ' + err.message);
  } finally {
    selectStatusImageBtn.disabled = false;
    selectStatusImageBtn.innerHTML = '<i class="fa-solid fa-photo-film"></i> Choose Image';
    statusImageInput.value = '';
  }
}

async function fetchStatuses() {
  try {
    const res = await fetch(`/api/status?requestor=${currentUser.username}`);
    const groupedData = await res.json();
    
    statusFeed = groupedData;
    renderStatusTray();
  } catch (err) {
    console.error('Error fetching statuses:', err);
  }
}

function renderStatusTray() {
  const myStatusItem = document.getElementById('my-status-item');
  const myStatusCircle = document.getElementById('my-status-circle');
  const myStatusAvatar = document.getElementById('my-status-avatar');
  
  document.querySelectorAll('.dyn-status-item').forEach(item => item.remove());

  updateAvatarDisplay(myStatusAvatar, currentUser.username, currentUser.avatarUrl);
  
  const myStatus = statusFeed[currentUser.username];
  if (myStatus && myStatus.stories && myStatus.stories.length > 0) {
    myStatusCircle.className = 'status-circle active-story';
    myStatusItem.setAttribute('onclick', `playStatus('${currentUser.username}')`);
  } else {
    myStatusCircle.className = 'status-circle';
    myStatusItem.setAttribute('onclick', `openStatusCreator()`);
  }

  Object.keys(statusFeed).forEach(username => {
    if (username.toLowerCase() === currentUser.username.toLowerCase()) return;
    
    const userFeed = statusFeed[username];
    const stories = userFeed.stories;
    const avatarUrl = userFeed.avatarUrl;
    
    if (!stories || stories.length === 0) return;

    const div = document.createElement('div');
    div.className = 'status-tray-item dyn-status-item';
    div.setAttribute('onclick', `playStatus('${username}')`);
    
    const avatarHtml = avatarUrl 
      ? `<img src="${avatarUrl}" alt="${username}">`
      : username.charAt(0).toUpperCase();

    div.innerHTML = `
      <div class="status-circle active-story">
        <div class="status-avatar">
          ${avatarHtml}
        </div>
      </div>
      <span class="status-label">${username}</span>
    `;
    statusTray.appendChild(div);
  });
}

function playStatus(username) {
  const feed = statusFeed[username];
  if (!feed || !feed.stories || feed.stories.length === 0) return;

  activeStoryUser = username;
  activeStoryIndex = 0;

  statusViewerModal.classList.remove('hidden');
  
  storyProgressContainer.innerHTML = '';
  feed.stories.forEach((s, i) => {
    const segment = document.createElement('div');
    segment.className = 'story-progress-segment';
    segment.innerHTML = `<div class="story-progress-fill" id="story-fill-${i}"></div>`;
    storyProgressContainer.appendChild(segment);
  });

  renderStorySlide(0);
}

function renderStorySlide(index) {
  clearTimeout(storyTimer);
  clearInterval(storyProgressInterval);

  const feed = statusFeed[activeStoryUser];
  if (!feed || index < 0 || index >= feed.stories.length) {
    closeStoryViewer();
    return;
  }

  activeStoryIndex = index;
  const story = feed.stories[index];

  storyAuthorName.textContent = activeStoryUser;
  updateAvatarDisplay(storyAuthorAvatar, activeStoryUser, feed.avatarUrl);

  const timeDiff = Date.now() - new Date(story.timestamp).getTime();
  const mins = Math.floor(timeDiff / (1000 * 60));
  const hours = Math.floor(mins / 60);
  let timeStr = 'Just now';
  if (hours > 0) timeStr = `${hours}h ago`;
  else if (mins > 0) timeStr = `${mins}m ago`;
  storyTimeLabel.textContent = timeStr;

  if (activeStoryUser.toLowerCase() === currentUser.username.toLowerCase()) {
    deleteStoryBtn.classList.remove('hidden');
  } else {
    deleteStoryBtn.classList.add('hidden');
  }

  for (let i = 0; i < feed.stories.length; i++) {
    const fill = document.getElementById(`story-fill-${i}`);
    if (fill) {
      if (i < index) {
        fill.style.transition = 'none';
        fill.style.width = '100%';
      } else if (i > index) {
        fill.style.transition = 'none';
        fill.style.width = '0%';
      } else {
        fill.style.transition = 'none';
        fill.style.width = '0%';
      }
    }
  }

  storyStage.innerHTML = '';
  if (story.type === 'text') {
    const gradClass = story.bgGradient || 'bg-gradient-1';
    storyStage.innerHTML = `
      <div class="story-content-text ${gradClass}">
        ${escapeHtml(story.content)}
      </div>`;
    
    setTimeout(() => {
      const fill = document.getElementById(`story-fill-${index}`);
      if (fill) {
        fill.style.transition = `width ${storyDuration}ms linear`;
        fill.style.width = '100%';
      }
    }, 30);

    storyTimer = setTimeout(() => {
      playNextStorySlide();
    }, storyDuration);

  } else if (story.type === 'video') {
    storyStage.innerHTML = `
      <video class="story-content-video" src="${story.content}" autoplay playsinline></video>`;
    
    const video = storyStage.querySelector('.story-content-video');
    if (video) {
      // Set a fallback timer in case video metadata fails to load (stuck loading)
      storyTimer = setTimeout(() => {
        playNextStorySlide();
      }, 10000);

      video.addEventListener('loadedmetadata', () => {
        // Clear the fallback loading timer immediately since metadata loaded successfully!
        clearTimeout(storyTimer);

        let duration = video.duration * 1000;
        if (isNaN(duration) || !isFinite(duration) || duration <= 0) {
          duration = 10000; // Fallback to 10s if invalid
        }
        
        setTimeout(() => {
          const fill = document.getElementById(`story-fill-${index}`);
          if (fill) {
            fill.style.transition = `width ${duration}ms linear`;
            fill.style.width = '100%';
          }
        }, 30);

        storyTimer = setTimeout(() => {
          playNextStorySlide();
        }, duration);
      });
    }

  } else {
    storyStage.innerHTML = `<img class="story-content-image" src="${story.content}" alt="Status Story">`;
    
    setTimeout(() => {
      const fill = document.getElementById(`story-fill-${index}`);
      if (fill) {
        fill.style.transition = `width ${storyDuration}ms linear`;
        fill.style.width = '100%';
      }
    }, 30);

    storyTimer = setTimeout(() => {
      playNextStorySlide();
    }, storyDuration);
  }
}

function playNextStorySlide() {
  const feed = statusFeed[activeStoryUser];
  if (!feed) {
    closeStoryViewer();
    return;
  }

  const nextIndex = activeStoryIndex + 1;
  if (nextIndex < feed.stories.length) {
    renderStorySlide(nextIndex);
  } else {
    closeStoryViewer();
  }
}

function playPreviousStorySlide() {
  const prevIndex = activeStoryIndex - 1;
  if (prevIndex >= 0) {
    renderStorySlide(prevIndex);
  } else {
    renderStorySlide(0);
  }
}

async function handleDeleteActiveStory() {
  const feed = statusFeed[activeStoryUser];
  if (!feed || !feed.stories || activeStoryIndex >= feed.stories.length) return;
  
  const story = feed.stories[activeStoryIndex];
  
  if (!confirm('Are you sure you want to delete this status update?')) return;
  
  try {
    deleteStoryBtn.disabled = true;
    deleteStoryBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:0.95rem;"></i>';
    
    const res = await fetch('/api/status/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser.username,
        id: story.id
      })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete status');
    }
    
    feed.stories.splice(activeStoryIndex, 1);
    
    if (feed.stories.length > 0) {
      let newIndex = activeStoryIndex;
      if (newIndex >= feed.stories.length) {
        newIndex = feed.stories.length - 1;
      }
      
      storyProgressContainer.innerHTML = '';
      feed.stories.forEach((s, i) => {
        const segment = document.createElement('div');
        segment.className = 'story-progress-segment';
        segment.innerHTML = `<div class="story-progress-fill" id="story-fill-${i}"></div>`;
        storyProgressContainer.appendChild(segment);
      });
      
      renderStorySlide(newIndex);
    } else {
      closeStoryViewer();
    }
    
    fetchStatuses();
  } catch (err) {
    alert('Error deleting status: ' + err.message);
  } finally {
    deleteStoryBtn.disabled = false;
    deleteStoryBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
  }
}

function closeStoryViewer() {
  clearTimeout(storyTimer);
  clearInterval(storyProgressInterval);
  statusViewerModal.classList.add('hidden');
  activeStoryUser = null;
  activeStoryIndex = 0;

  // Pause playing video, release stream, and wipe DOM content
  const video = storyStage.querySelector('.story-content-video');
  if (video) {
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
    } catch (e) {
      console.warn('Error releasing video on close:', e);
    }
  }
  storyStage.innerHTML = '';
}

/* --- CHAT MESSAGE DELETION CONTROLLERS --- */
window.toggleMessageMenu = function(msgId, event) {
  event.stopPropagation();
  
  document.querySelectorAll('.message-options-menu').forEach(menu => {
    if (menu.id !== `menu-${msgId}`) menu.classList.add('hidden');
  });
  
  const menu = document.getElementById(`menu-${msgId}`);
  if (menu) {
    menu.classList.toggle('hidden');
  }
};

window.deleteChatMsg = async function(msgId, action, event) {
  event.stopPropagation();

  const confirmText = action === 'everyone' 
    ? 'Delete this message for everyone?' 
    : 'Delete this message for me?';

  if (!confirm(confirmText)) {
    const menu = document.getElementById(`menu-${msgId}`);
    if (menu) menu.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch('/api/messages/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser.username,
        messageId: msgId,
        action
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete message');
    }

    if (action === 'me') {
      const bubble = document.getElementById(`msg-${msgId}`);
      if (bubble) bubble.remove();
    }
  } catch (err) {
    alert('Error deleting message: ' + err.message);
  }
};

/* --- CLEAR ENTIRE CHAT HISTORY HANDLER --- */
async function handleClearChat() {
  const confirmMsg = activeChat === 'group' 
    ? 'Are you sure you want to clear the public group chat history for you?' 
    : `Are you sure you want to clear all messages in your chat with ${activeChat}?`;

  if (!confirm(confirmMsg)) return;

  try {
    headerClearBtn.disabled = true;
    headerClearBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:1.15rem;"></i>';

    const res = await fetch('/api/messages/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser.username,
        receiver: activeChat
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to clear chat');
    }

    // Instantly wipe chat window messages UI
    messagesDisplay.innerHTML = `
      <div class="welcome-chat">
        <i class="fa-solid fa-comments"></i>
        <h3>Chat Cleared</h3>
        <p>All chat history has been cleared for you.</p>
      </div>`;

    updateSidebarPreview(activeChat === 'group' ? 'group' : activeChat.toLowerCase(), 'Chat cleared');
  } catch (err) {
    alert('Error clearing chat: ' + err.message);
  } finally {
    headerClearBtn.disabled = false;
    headerClearBtn.innerHTML = '<i class="fa-solid fa-broom"></i>';
  }
}

/* --- WEBRTC P2P CALL MANAGEMENT --- */
async function initiateCall(type) {
  if (activeChat === 'group') return;
  if (callActive) return;

  currentCallUser = activeChat;
  callType = type;
  isCallInitiator = true;
  callActive = true;

  // Setup UI Labels
  callUsername.textContent = currentCallUser;
  callAvatarBox.textContent = currentCallUser.charAt(0).toUpperCase();
  callStatus.textContent = `Calling ${currentCallUser}...`;

  incomingCallControls.classList.add('hidden');
  activeCallControls.classList.remove('hidden');

  if (type === 'voice') {
    toggleVideoBtn.classList.add('hidden');
    callVideoContainer.classList.add('hidden');
  } else {
    toggleVideoBtn.classList.remove('hidden');
    callVideoContainer.classList.remove('hidden');
  }

  callOverlay.classList.remove('hidden');
  startRingtone('outgoing');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('WebRTC calling requires a Secure Context (HTTPS or localhost). Access denied by browser.');
    cleanupCall();
    return;
  }

  // Request Microphone and Camera feeds
  try {
    const constraints = {
      audio: true,
      video: type === 'video'
    };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);

    if (type === 'video') {
      localVideo.srcObject = localStream;
      localVideo.classList.remove('hidden');
    }

    // Emit Call request via Socket to Signaling Server
    socket.emit('call_user', { to: currentCallUser, type });
  } catch (err) {
    console.error('Media access permission denied:', err);
    alert('Access to microphone or camera was denied. Please adjust your browser permissions.');
    handleHangUpCall();
  }
}

async function handleAnswerCall() {
  stopRingtone();
  incomingCallControls.classList.add('hidden');
  activeCallControls.classList.remove('hidden');

  if (callType === 'voice') {
    toggleVideoBtn.classList.add('hidden');
    callVideoContainer.classList.add('hidden');
  } else {
    toggleVideoBtn.classList.remove('hidden');
    callVideoContainer.classList.remove('hidden');
  }

  callStatus.textContent = 'Answering...';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('WebRTC calling requires a Secure Context (HTTPS or localhost). Access denied by browser.');
    handleRejectCall();
    return;
  }

  try {
    const constraints = {
      audio: true,
      video: callType === 'video'
    };
    localStream = await navigator.mediaDevices.getUserMedia(constraints);

    if (callType === 'video') {
      localVideo.srcObject = localStream;
      localVideo.classList.remove('hidden');
    }

    // Notify caller of acceptance
    socket.emit('accept_call', { to: currentCallUser });
  } catch (err) {
    console.error('Media access failed on answer:', err);
    alert('Microphone/Camera access failed. Call rejected.');
    handleRejectCall();
  }
}

function handleRejectCall() {
  stopRingtone();
  if (currentCallUser) {
    socket.emit('reject_call', { to: currentCallUser });
  }
  cleanupCall();
}

function handleHangUpCall() {
  stopRingtone();
  if (currentCallUser) {
    socket.emit('end_call', { to: currentCallUser });
  }
  cleanupCall();
}

async function setupPeerConnection() {
  peerConnection = new RTCPeerConnection(iceServers);

  // Attach local media tracks
  if (localStream) {
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });
  }

  // Handle local ICE candidates gathered
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && currentCallUser) {
      socket.emit('ice_candidate', { to: currentCallUser, candidate: event.candidate });
    }
  };

  // Bind incoming remote stream tracks
  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    remoteVideo.srcObject = remoteStream;
    
    // Bind to audio helper for bulletproof sound flow
    const remoteAudio = document.getElementById('remote-audio');
    if (remoteAudio) {
      remoteAudio.srcObject = remoteStream;
    }

    callVideoContainer.classList.remove('hidden');

    callStatus.textContent = 'Connected';
    startCallTimer();
  };
}

async function processQueuedIceCandidates() {
  if (!peerConnection || !peerConnection.remoteDescription || !peerConnection.remoteDescription.type) return;

  while (remoteIceCandidatesQueue.length > 0) {
    const candidate = remoteIceCandidatesQueue.shift();
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('Successfully applied queued ICE Candidate');
    } catch (e) {
      console.error('Error applying queued ICE Candidate:', e);
    }
  }
}

function startCallTimer() {
  clearInterval(callTimerInterval);
  callStartTime = Date.now();

  callTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    callStatus.textContent = `${minutes}:${seconds}`;
  }, 1000);
}

function toggleMuteMic() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      
      if (audioTrack.enabled) {
        muteMicBtn.classList.add('active');
        muteMicBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        muteMicBtn.title = 'Mute Microphone';
      } else {
        muteMicBtn.classList.remove('active');
        muteMicBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        muteMicBtn.title = 'Unmute Microphone';
      }
    }
  }
}

function toggleMuteVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      
      if (videoTrack.enabled) {
        toggleVideoBtn.classList.add('active');
        toggleVideoBtn.innerHTML = '<i class="fa-solid fa-video"></i>';
        toggleVideoBtn.title = 'Mute Camera';
        localVideo.classList.remove('hidden');
      } else {
        toggleVideoBtn.classList.remove('active');
        toggleVideoBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i>';
        toggleVideoBtn.title = 'Unmute Camera';
        localVideo.classList.add('hidden');
      }
    }
  }
}

function cleanupCall() {
  stopRingtone();
  clearInterval(callTimerInterval);

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  
  const remoteAudio = document.getElementById('remote-audio');
  if (remoteAudio) {
    remoteAudio.srcObject = null;
  }

  callOverlay.classList.add('hidden');
  callActive = false;
  currentCallUser = null;
  callType = null;
  isCallInitiator = false;

  // Reset toggles states
  muteMicBtn.classList.add('active');
  muteMicBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
  toggleVideoBtn.classList.add('active');
  toggleVideoBtn.innerHTML = '<i class="fa-solid fa-video"></i>';

  localVideo.classList.add('hidden');
  remoteIceCandidatesQueue = [];
}

/* --- SYNTHESIZED RINGTONE CONTROLLER (WEB AUDIO API) --- */
function startRingtone(type) {
  if (isRingtonePlaying) return;
  isRingtonePlaying = true;

  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  ringtoneGain = audioCtx.createGain();
  ringtoneGain.connect(audioCtx.destination);
  ringtoneGain.gain.setValueAtTime(0, audioCtx.currentTime);

  const playLoop = () => {
    if (!isRingtonePlaying) return;

    if (type === 'outgoing') {
      // Outgoing calling signal: Dual frequency 440Hz & 480Hz
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      osc1.connect(ringtoneGain);
      osc2.connect(ringtoneGain);

      osc1.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc2.frequency.setValueAtTime(480, audioCtx.currentTime);

      ringtoneGain.gain.setValueAtTime(0.08, audioCtx.currentTime);

      osc1.start();
      osc2.start();

      setTimeout(() => {
        try {
          osc1.stop();
          osc2.stop();
        } catch (e) {}

        if (isRingtonePlaying) {
          setTimeout(playLoop, 3500); // 3.5s pause
        }
      }, 2000); // 2s ringing

    } else if (type === 'incoming') {
      // Incoming Alert: pleasant musical chime sequences (E5, G5, A5, C6)
      const playChimeNote = (freq, delay, dur) => {
        if (!isRingtonePlaying) return;
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);

        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime + delay);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + dur);

        osc.start(audioCtx.currentTime + delay);
        osc.stop(audioCtx.currentTime + delay + dur);
      };

      playChimeNote(659.25, 0, 0.4);      // E5
      playChimeNote(783.99, 0.15, 0.4);   // G5
      playChimeNote(880.00, 0.30, 0.4);   // A5
      playChimeNote(1046.50, 0.45, 0.8);  // C6

      setTimeout(() => {
        if (isRingtonePlaying) {
          playLoop();
        }
      }, 2500);
    }
  };

  playLoop();
}

function stopRingtone() {
  isRingtonePlaying = false;
  if (ringtoneGain) {
    try {
      ringtoneGain.gain.setValueAtTime(0, audioCtx.currentTime);
    } catch (e) {}
  }
}

/* --- HTML5 PUSH NOTIFICATIONS REGISTER --- */
async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push alerts are not supported in this browser.');
    updatePushSettingsUI();
    return;
  }

  try {
    // 1. Register the Service Worker (sw.js)
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Push Service Worker registered scope:', registration.scope);

    // 2. Request Notification Perms
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('User denied background notification permissions.');
      updatePushSettingsUI();
      return;
    }

    // 3. Request VAPID crypt key from Node server
    const res = await fetch('/api/push/public-key');
    const data = await res.json();
    if (!res.ok || !data.publicKey) {
      throw new Error('VAPID public key not found');
    }

    // 4. Retrieve or Create subscription channel
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey)
      });
    }

    // 5. Send subscription endpoints keys to database
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser.username,
        subscription
      })
    });
    console.log('Background push subscription synced.');
    updatePushSettingsUI();
  } catch (err) {
    console.error('Failed to configure background push registration:', err);
    updatePushSettingsUI();
  }
}

function updatePushSettingsUI() {
  const desc = document.getElementById('push-status-desc');
  const badge = document.getElementById('push-status-badge');
  if (!desc || !badge) return;

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    desc.textContent = 'Unsupported: Your browser or connection (HTTP) does not support push notifications. Secure Context (HTTPS or localhost) required.';
    badge.className = 'badge-status disabled';
    badge.textContent = 'Unsupported';
    return;
  }

  if (Notification.permission === 'denied') {
    desc.textContent = 'Disabled: Notifications are blocked by your browser settings. Please click lock icon next to URL and select "Allow".';
    badge.className = 'badge-status disabled';
    badge.textContent = 'Blocked';
  } else if (Notification.permission === 'granted') {
    desc.textContent = 'Active: You will receive notifications when tabs are closed or device is locked.';
    badge.className = 'badge-status active';
    badge.textContent = 'Active';
  } else {
    desc.textContent = 'Pending: Reload or check site configurations to allow background notification popups.';
    badge.className = 'badge-status';
    badge.textContent = 'Pending';
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/* --- SOCKET MANAGEMENT --- */
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    socket.emit('authenticate', { username: currentUser.username });
  });

  socket.on('user_status_change', ({ username, online }) => {
    if (username.toLowerCase() === currentUser.username.toLowerCase()) return;

    const user = registeredUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
      user.online = online;
    } else {
      registeredUsers.push({ username, online, bio: '', avatarUrl: null });
    }
    
    renderUsersList();

    if (activeChat && activeChat.toLowerCase() === username.toLowerCase()) {
      activeChatStatus.textContent = online ? 'Online' : 'Offline';
    }

    if (!online) {
      clearTypingIndicator(username);
    }
  });

  socket.on('online_users_list', (onlineUsernames) => {
    const lowerOnline = onlineUsernames.map(u => u.toLowerCase());
    registeredUsers.forEach(user => {
      user.online = lowerOnline.includes(user.username.toLowerCase());
    });
    renderUsersList();
  });

  socket.on('status_update', () => {
    fetchStatuses();
  });

  socket.on('message_deleted', ({ id, isDeletedForEveryone }) => {
    const bubble = document.getElementById(`msg-${id}`);
    if (bubble) {
      if (isDeletedForEveryone) {
        const wrapper = bubble.querySelector('.message-content-wrapper');
        if (wrapper) {
          wrapper.innerHTML = `<span class="message-deleted-text"><i class="fa-solid fa-ban"></i> This message was deleted</span>`;
          wrapper.style.paddingRight = '1rem';
        }
        
        const trigger = bubble.querySelector('.message-options-trigger');
        if (trigger) trigger.remove();
        
        const menu = bubble.querySelector('.message-options-menu');
        if (menu) menu.remove();
      }
    }
  });

  socket.on('private_message', (msg) => {
    const otherUser = msg.sender.toLowerCase() === currentUser.username.toLowerCase() ? msg.receiver : msg.sender;
    const previewText = msg.file ? `📎 [File] ${msg.file.name}` : msg.text;
    updateSidebarPreview(otherUser, `${msg.sender}: ${previewText}`);

    if (activeChat && activeChat !== 'group' && activeChat.toLowerCase() === otherUser.toLowerCase()) {
      appendMessage(msg);
      if (msg.sender.toLowerCase() !== currentUser.username.toLowerCase()) {
        socket.emit('read_messages', { sender: msg.sender });
      }
    } else {
      incrementUnread(otherUser);
    }

    if (msg.sender.toLowerCase() !== currentUser.username.toLowerCase()) {
      playNotificationSound();
    }
  });

  socket.on('private_message_error', ({ to, error }) => {
    if (activeChat && activeChat.toLowerCase() === to.toLowerCase()) {
      const welcomePlaceholder = messagesDisplay.querySelector('.welcome-chat');
      if (welcomePlaceholder) welcomePlaceholder.remove();

      const bubble = document.createElement('div');
      bubble.style.alignSelf = 'center';
      bubble.style.background = 'rgba(239, 68, 68, 0.1)';
      bubble.style.border = '1px solid rgba(239, 68, 68, 0.2)';
      bubble.style.color = '#ef4444';
      bubble.style.padding = '0.5rem 1rem';
      bubble.style.borderRadius = '8px';
      bubble.style.fontSize = '0.85rem';
      bubble.style.margin = '0.5rem 0';
      bubble.style.textAlign = 'center';
      bubble.textContent = error;
      
      messagesDisplay.appendChild(bubble);
      scrollToBottom();
    }
  });

  socket.on('group_message', (msg) => {
    const previewText = msg.file ? `📎 [File] ${msg.file.name}` : msg.text;
    updateSidebarPreview(msg.receiver, `${msg.sender}: ${previewText}`);

    if (activeChat === msg.receiver) {
      appendMessage(msg);
    } else {
      incrementUnread(msg.receiver);
    }

    if (msg.sender.toLowerCase() !== currentUser.username.toLowerCase()) {
      playNotificationSound();
    }
  });

  socket.on('group_created', (group) => {
    if (group.members.some(m => m.toLowerCase() === currentUser.username.toLowerCase())) {
      if (!myGroups.some(g => g.id === group.id)) {
        myGroups.push(group);
        renderRoomsList();
      }
    }
  });

  socket.on('group_updated', (group) => {
    if (group.members.some(m => m.toLowerCase() === currentUser.username.toLowerCase())) {
      const index = myGroups.findIndex(g => g.id === group.id);
      if (index !== -1) {
        myGroups[index] = group;
      } else {
        myGroups.push(group);
      }
      renderRoomsList();
      
      if (activeChat === group.id) {
        activeChatStatus.textContent = `${group.members.length} members`;
      }
    }
  });

  socket.on('group_deleted', ({ id }) => {
    myGroups = myGroups.filter(g => g.id !== id);
    renderRoomsList();
    if (activeChat === id) {
      selectChat('group');
      alert('The group was deleted.');
    }
  });

  socket.on('kicked_from_group', ({ id, name }) => {
    myGroups = myGroups.filter(g => g.id !== id);
    renderRoomsList();
    if (activeChat === id) {
      selectChat('group');
      alert(`You have been kicked from the group "${name}".`);
    }
  });

  socket.on('post_created', (post) => {
    if (!postsFeed.some(p => p.id === post.id)) {
      postsFeed.unshift(post);
      if (activeFeedTab === 'all' || (activeFeedTab === 'reels' && post.media && post.media.type.startsWith('video/'))) {
        renderPostsFeed();
      }
    }
  });

  socket.on('post_liked', ({ postId, likes }) => {
    const post = postsFeed.find(p => p.id === postId);
    if (post) {
      post.likes = likes;
      updatePostLikeDOM(postId, likes);
    }
  });

  socket.on('post_commented', ({ postId, comment }) => {
    const post = postsFeed.find(p => p.id === postId);
    if (post) {
      if (!post.comments.some(c => c.id === comment.id)) {
        post.comments.push(comment);
        updatePostCommentDOM(postId, comment);
      }
    }
  });

  socket.on('post_reply_added', ({ postId, commentId, reply }) => {
    const post = postsFeed.find(p => p.id === postId);
    if (post) {
      const comment = post.comments.find(c => c.id === commentId);
      if (comment) {
        if (!comment.replies) comment.replies = [];
        if (!comment.replies.some(r => r.id === reply.id)) {
          comment.replies.push(reply);
          updatePostReplyDOM(postId, commentId, reply);
        }
      }
    }
  });

  socket.on('post_comment_deleted', ({ postId, commentId }) => {
    const post = postsFeed.find(p => p.id === postId);
    if (post) {
      post.comments = post.comments.filter(c => c.id !== commentId);
      const commentDiv = document.getElementById(`comment-container-${commentId}`);
      if (commentDiv) commentDiv.remove();
      
      const countLabel = document.getElementById(`comments-count-${postId}`);
      if (countLabel) countLabel.textContent = `${post.comments.length} Comments`;
    }
  });

  socket.on('post_reply_deleted', ({ postId, commentId, replyId }) => {
    const post = postsFeed.find(p => p.id === postId);
    if (post) {
      const comment = post.comments.find(c => c.id === commentId);
      if (comment && comment.replies) {
        comment.replies = comment.replies.filter(r => r.id !== replyId);
        const replyDiv = document.getElementById(`reply-container-${replyId}`);
        if (replyDiv) replyDiv.remove();
      }
    }
  });

  socket.on('typing', ({ from, to, isTyping }) => {
    if (to === 'group' && activeChat === 'group') {
      if (isTyping && from !== currentUser.username) {
        showTypingIndicator(`${from} is typing...`, from);
      } else {
        clearTypingIndicator(from);
      }
    } else if (to !== 'group' && activeChat && activeChat !== 'group' && activeChat.toLowerCase() === from.toLowerCase()) {
      if (isTyping) {
        showTypingIndicator('typing...', from);
      } else {
        clearTypingIndicator(from);
      }
    }
  });

  socket.on('messages_delivered', ({ receiver, messageIds }) => {
    if (activeChat && activeChat !== 'group' && activeChat.toLowerCase() === receiver.toLowerCase()) {
      messageIds.forEach(id => {
        const bubble = document.getElementById(`msg-${id}`);
        if (bubble) {
          const ticksContainer = bubble.querySelector('.message-meta');
          if (ticksContainer) {
            const ticks = ticksContainer.querySelector('.msg-ticks');
            if (ticks) {
              ticks.className = 'msg-ticks delivered';
              ticks.innerHTML = '<i class="fa-solid fa-check"></i><i class="fa-solid fa-check"></i>';
            }
          }
        }
      });
    }
  });

  socket.on('messages_read', ({ reader, messageIds }) => {
    if (activeChat && activeChat !== 'group' && activeChat.toLowerCase() === reader.toLowerCase()) {
      messageIds.forEach(id => {
        const bubble = document.getElementById(`msg-${id}`);
        if (bubble) {
          const ticksContainer = bubble.querySelector('.message-meta');
          if (ticksContainer) {
            const ticks = ticksContainer.querySelector('.msg-ticks');
            if (ticks) {
              ticks.className = 'msg-ticks read';
              ticks.innerHTML = '<i class="fa-solid fa-check"></i><i class="fa-solid fa-check"></i>';
            }
          }
        }
      });
    }
  });

  // --- WEBRTC INCOMING SIGNALS ---
  socket.on('incoming_call', ({ from, type }) => {
    if (callActive) {
      socket.emit('reject_call', { to: from });
      return;
    }

    currentCallUser = from;
    callType = type;
    isCallInitiator = false;
    callActive = true;

    callUsername.textContent = from;
    callAvatarBox.textContent = from.charAt(0).toUpperCase();
    callStatus.textContent = `Incoming ${type} Call...`;

    incomingCallControls.classList.remove('hidden');
    activeCallControls.classList.add('hidden');
    callVideoContainer.classList.add('hidden');

    callOverlay.classList.remove('hidden');
    startRingtone('incoming');
  });

  socket.on('call_accepted', async () => {
    stopRingtone();
    callStatus.textContent = 'Connecting...';

    await setupPeerConnection();

    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('call_offer', { to: currentCallUser, offer });
    } catch (err) {
      console.error('Error creating WebRTC offer:', err);
      handleHangUpCall();
    }
  });

  socket.on('call_rejected', () => {
    stopRingtone();
    callStatus.textContent = 'Call Rejected';
    setTimeout(() => {
      cleanupCall();
    }, 1500);
  });

  socket.on('call_offer', async ({ from, offer }) => {
    stopRingtone();
    callStatus.textContent = 'Connecting...';

    if (!peerConnection) {
      await setupPeerConnection();
    }

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      await processQueuedIceCandidates();
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('call_answer', { to: currentCallUser, answer });
    } catch (err) {
      console.error('Error generating and answering offer:', err);
      handleHangUpCall();
    }
  });

  socket.on('call_answer', async ({ answer }) => {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      await processQueuedIceCandidates();
    } catch (err) {
      console.error('Error setting remote answer:', err);
      handleHangUpCall();
    }
  });

  socket.on('ice_candidate', async ({ candidate }) => {
    try {
      if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        remoteIceCandidatesQueue.push(candidate);
      }
    } catch (err) {
      console.error('Error attaching ICE candidate:', err);
    }
  });

  socket.on('end_call', () => {
    cleanupCall();
  });

  socket.on('call_error', ({ error }) => {
    stopRingtone();
    alert(error);
    cleanupCall();
  });
}

/* --- API DATA FETCHERS --- */
async function fetchUsers() {
  try {
    const res = await fetch(`/api/users?requestor=${currentUser.username}`);
    const data = await res.json();
    
    registeredUsers = data.filter(
      u => u.username.toLowerCase() !== currentUser.username.toLowerCase()
    );
    renderUsersList();
  } catch (err) {
    console.error('Error fetching users:', err);
  }
}

async function fetchChatHistory() {
  messagesDisplay.innerHTML = '<div class="welcome-chat"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading messages...</p></div>';

  let url = `/api/messages?receiver=${activeChat}&requestor=${currentUser.username}`;
  if (activeChat !== 'group') {
    url += `&sender=${currentUser.username}`;
  }

  try {
    const res = await fetch(url);
    const msgs = await res.json();
    
    messagesDisplay.innerHTML = '';
    if (msgs.length === 0) {
      messagesDisplay.innerHTML = `
        <div class="welcome-chat">
          <i class="fa-solid fa-comments"></i>
          <h3>No messages yet</h3>
          <p>Send a message to start the conversation!</p>
        </div>`;
    } else {
      msgs.forEach(msg => appendMessage(msg));
    }
  } catch (err) {
    console.error('Error fetching history:', err);
    messagesDisplay.innerHTML = '<div class="welcome-chat"><p>Failed to load message history.</p></div>';
  }
}

/* --- RENDER WORKSPACE COMPONENTS --- */
function renderUsersList() {
  const searchQuery = searchUsersInput.value.toLowerCase().trim();
  usersList.innerHTML = '';

  const filteredUsers = registeredUsers.filter(u => 
    u.username.toLowerCase().includes(searchQuery)
  );

  if (filteredUsers.length === 0) {
    usersList.innerHTML = `<li class="tab-title" style="text-align:center; padding: 1.5rem 0;">No contacts found</li>`;
    return;
  }

  filteredUsers.sort((a, b) => {
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return a.username.localeCompare(b.username);
  });

  filteredUsers.forEach(user => {
    const username = user.username;
    const isOnline = user.online;
    const userBio = user.bio || '';
    const avatarUrl = user.avatarUrl || null;
    const isActive = activeChat !== 'group' && activeChat.toLowerCase() === username.toLowerCase();
    
    const unread = unreadCounts.get(username.toLowerCase()) || 0;
    const badgeHtml = unread > 0 ? `<div class="badge" id="badge-${username.toLowerCase()}">${unread}</div>` : '';
    
    let statusText = isOnline ? 'online' : 'offline';
    if (userBio) {
      statusText = userBio;
    }

    const isBlocked = currentUser.blockedUsers && currentUser.blockedUsers.some(
      u => u.toLowerCase() === username.toLowerCase()
    );
    if (isBlocked) {
      statusText = 'Blocked';
    }
    
    const li = document.createElement('li');
    li.className = `chat-item ${isActive ? 'active' : ''}`;
    li.setAttribute('onclick', `selectChat('${username}')`);
    li.id = `chat-item-${username.toLowerCase()}`;
    
    const avatarHtml = avatarUrl 
      ? `<img src="${avatarUrl}" alt="${username}">`
      : username.charAt(0).toUpperCase();
    
    li.innerHTML = `
      <div class="chat-avatar">
        ${avatarHtml}
        <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
      </div>
      <div class="chat-details">
        <span class="chat-name">${username}</span>
        <span class="chat-preview" id="preview-${username.toLowerCase()}">${statusText}</span>
      </div>
      ${badgeHtml}
    `;
    usersList.appendChild(li);
  });
}

function selectChat(target) {
  chatContainer.classList.remove('no-active-chat');
  switchSidebarNav('chats');
  typingIndicatorBox.classList.add('hidden');
  typingTimers.clear();

  activeChat = target;

  updateHeaderBlockButton(target);

  headerGroupInfoBtn.classList.add('hidden');

  if (target === 'group') {
    activeChatTitle.textContent = 'Public Group Room';
    activeChatStatus.textContent = 'Everyone can read and send messages';
    activeChatAvatar.innerHTML = '<i class="fa-solid fa-users"></i>';
    activeChatAvatar.className = 'chat-avatar group-avatar';
    
    document.getElementById('chat-item-group').classList.add('active');
    unreadCounts.set('group', 0);
    document.getElementById('badge-group').classList.add('hidden');

    // Hide Calling buttons in group chats (private p2p calls only)
    headerVoiceCallBtn.classList.add('hidden');
    headerVideoCallBtn.classList.add('hidden');
  } else if (target.startsWith('group_')) {
    const group = myGroups.find(g => g.id === target);
    const groupName = group ? group.name : 'Custom Group';
    activeChatTitle.textContent = groupName;
    activeChatStatus.textContent = group ? `${group.members.length} members` : 'Custom Group Chat';
    activeChatAvatar.innerHTML = '<i class="fa-solid fa-users-rectangle"></i>';
    activeChatAvatar.className = 'chat-avatar group-avatar';
    
    document.getElementById('chat-item-group').classList.remove('active');
    
    unreadCounts.set(target, 0);
    const badge = document.getElementById(`badge-${target}`);
    if (badge) badge.classList.add('hidden');

    // Hide calling options in group chats
    headerVoiceCallBtn.classList.add('hidden');
    headerVideoCallBtn.classList.add('hidden');

    // Show Group Info button!
    headerGroupInfoBtn.classList.remove('hidden');
  } else {
    activeChatTitle.textContent = target;
    const user = registeredUsers.find(u => u.username.toLowerCase() === target.toLowerCase());
    const isOnline = user ? user.online : false;
    const avatarUrl = user ? user.avatarUrl : null;
    
    activeChatStatus.textContent = isOnline ? 'Online' : 'Offline';
    updateAvatarDisplay(activeChatAvatar, target, avatarUrl);
    activeChatAvatar.className = 'chat-avatar';
    
    document.getElementById('chat-item-group').classList.remove('active');
    
    unreadCounts.set(target.toLowerCase(), 0);

    // Show call options in private DMs
    headerVoiceCallBtn.classList.remove('hidden');
    headerVideoCallBtn.classList.remove('hidden');

    if (socket && socket.connected) {
      socket.emit('read_messages', { sender: target });
    }
  }

  // Update active room/channel selection styles in the DOM
  document.querySelectorAll('#rooms-list .chat-item').forEach(item => {
    if (item.id === `chat-item-${target}`) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  renderUsersList();
  chatContainer.classList.add('active-chat');
  fetchChatHistory();
}

function appendMessage(msg) {
  const welcomePlaceholder = messagesDisplay.querySelector('.welcome-chat');
  if (welcomePlaceholder) {
    welcomePlaceholder.remove();
  }

  const isSelf = msg.sender.toLowerCase() === currentUser.username.toLowerCase();
  
  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${isSelf ? 'self' : 'other'}`;
  bubble.id = `msg-${msg.id}`;
  
  const time = new Date(msg.timestamp);
  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (msg.isDeletedForEveryone) {
    bubble.innerHTML = `
      <span class="message-sender">${msg.sender}</span>
      <div class="message-content-wrapper" style="padding-right:1rem !important;">
        <span class="message-deleted-text"><i class="fa-solid fa-ban"></i> This message was deleted</span>
      </div>
      <div class="message-meta">
        <span class="message-time">${formattedTime}</span>
      </div>
    `;
    messagesDisplay.appendChild(bubble);
    scrollToBottom();
    return;
  }

  let contentHtml = '';
  
  if (msg.text) {
    contentHtml += `<div class="message-text">${escapeHtml(msg.text)}</div>`;
  }

  if (msg.file) {
    const file = msg.file;
    const mime = file.type || '';

    if (mime.startsWith('image/')) {
      contentHtml += `
        <div class="message-media-container">
          <img class="message-media-image" src="${file.url}" alt="${escapeHtml(file.name)}" onclick="window.open('${file.url}', '_blank')">
        </div>`;
    } else if (mime.startsWith('video/')) {
      contentHtml += `
        <div class="message-media-container">
          <video class="message-media-video" src="${file.url}" controls></video>
        </div>`;
    } else {
      contentHtml += `
        <a href="${file.url}" download="${escapeHtml(file.name)}" class="message-media-file">
          <div class="file-icon-box"><i class="fa-solid ${getFileIconClass(mime)}"></i></div>
          <div class="file-info-box">
            <span class="file-name-label">${escapeHtml(file.name)}</span>
            <span class="file-size-label">${formatBytes(file.size)}</span>
          </div>
          <i class="fa-solid fa-download file-dl-icon"></i>
        </a>`;
    }
  }

  const menuId = `menu-${msg.id}`;
  let optionButtonsHtml = `<button onclick="deleteChatMsg('${msg.id}', 'me', event)" class="delete-btn"><i class="fa-solid fa-eye-slash"></i> Delete for me</button>`;
  if (isSelf) {
    optionButtonsHtml += `<button onclick="deleteChatMsg('${msg.id}', 'everyone', event)" class="delete-btn"><i class="fa-solid fa-trash-can"></i> Delete for everyone</button>`;
  }

  const dropdownHtml = `
    <div class="message-options-trigger" onclick="toggleMessageMenu('${msg.id}', event)">
      <i class="fa-solid fa-chevron-down"></i>
    </div>
    <div class="message-options-menu hidden" id="${menuId}">
      ${optionButtonsHtml}
    </div>
  `;

  let ticksHtml = '';
  if (isSelf && msg.receiver !== 'group' && !msg.receiver.startsWith('group_')) {
    if (msg.status === 'read') {
      ticksHtml = '<span class="msg-ticks read"><i class="fa-solid fa-check"></i><i class="fa-solid fa-check"></i></span>';
    } else if (msg.status === 'delivered') {
      ticksHtml = '<span class="msg-ticks delivered"><i class="fa-solid fa-check"></i><i class="fa-solid fa-check"></i></span>';
    } else {
      ticksHtml = '<span class="msg-ticks sent"><i class="fa-solid fa-check"></i></span>';
    }
  }

  bubble.innerHTML = `
    <span class="message-sender">${msg.sender}</span>
    <div class="message-content-wrapper">
      ${dropdownHtml}
      ${contentHtml}
    </div>
    <div class="message-meta">
      <span class="message-time">${formattedTime}</span>
      ${ticksHtml}
    </div>
  `;
  
  messagesDisplay.appendChild(bubble);
  scrollToBottom();
}

function handleSendMessage(e) {
  e.preventDefault();
  if (!socket || !activeChat) return;

  const text = messageInput.value.trim();
  if (!text) return;

  if (activeChat === 'group' || activeChat.startsWith('group_')) {
    socket.emit('group_message', { to: activeChat, text });
  } else {
    socket.emit('private_message', { to: activeChat, text });
  }

  socket.emit('typing', { to: activeChat, isTyping: false });

  messageInput.value = '';
  messageInput.focus();
}

function updateSidebarPreview(targetUser, text) {
  const cleanTarget = targetUser.toLowerCase();
  if (cleanTarget === 'group') {
    const preview = document.getElementById('group-preview');
    if (preview) preview.textContent = text;
  } else if (cleanTarget.startsWith('group_')) {
    const preview = document.getElementById(`preview-${cleanTarget}`);
    if (preview) preview.textContent = text;
  } else {
    const preview = document.getElementById(`preview-${cleanTarget}`);
    if (preview) preview.textContent = text;
  }
}

function incrementUnread(sender) {
  const cleanSender = sender.toLowerCase();
  const count = (unreadCounts.get(cleanSender) || 0) + 1;
  unreadCounts.set(cleanSender, count);

  if (cleanSender === 'group') {
    const badge = document.getElementById('badge-group');
    if (badge) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    }
  } else if (cleanSender.startsWith('group_')) {
    const badge = document.getElementById(`badge-${cleanSender}`);
    if (badge) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    }
  } else {
    renderUsersList();
  }
}

/* --- DYNAMIC GROUP CHATS FLOW HANDLERS --- */
async function fetchGroups() {
  try {
    const res = await fetch(`/api/groups?username=${currentUser.username}`);
    const data = await res.json();
    myGroups = data;
    renderRoomsList();
  } catch (err) {
    console.error('Error fetching groups:', err);
  }
}

function renderRoomsList() {
  let html = `
    <li class="chat-item ${activeChat === 'group' ? 'active' : ''}" id="chat-item-group" onclick="selectChat('group')">
      <div class="chat-avatar group-avatar"><i class="fa-solid fa-users"></i></div>
      <div class="chat-details">
        <span class="chat-name">Public Group Room</span>
        <span class="chat-preview" id="group-preview">Chat with everyone here</span>
      </div>
      <div class="badge hidden" id="badge-group">0</div>
    </li>
  `;

  myGroups.forEach(g => {
    const unread = unreadCounts.get(g.id) || 0;
    const badgeHtml = unread > 0 ? `<div class="badge" id="badge-${g.id}">${unread}</div>` : `<div class="badge hidden" id="badge-${g.id}">0</div>`;

    html += `
      <li class="chat-item ${activeChat === g.id ? 'active' : ''}" id="chat-item-${g.id}" onclick="selectChat('${g.id}')">
        <div class="chat-avatar group-avatar"><i class="fa-solid fa-users-rectangle"></i></div>
        <div class="chat-details">
          <span class="chat-name">${escapeHtml(g.name)}</span>
          <span class="chat-preview" id="preview-${g.id.toLowerCase()}">Custom Group Chat</span>
        </div>
        ${badgeHtml}
      </li>
    `;
  });

  roomsList.innerHTML = html;
}

function openGroupCreator() {
  groupNameInput.value = '';
  groupCreateError.textContent = '';
  
  groupMembersSelectList.innerHTML = '';
  if (registeredUsers.length === 0) {
    groupMembersSelectList.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem; padding: 0.5rem;">No contacts available to add</span>';
  } else {
    registeredUsers.forEach(u => {
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.style.gap = '0.5rem';
      div.style.padding = '0.25rem 0.5rem';
      
      div.innerHTML = `
        <input type="checkbox" id="member-select-${u.username}" value="${u.username}" style="width:16px; height:16px; cursor:pointer;">
        <label for="member-select-${u.username}" style="color:white; font-size:0.9rem; cursor:pointer; flex:1; margin: 0;">${u.username}</label>
      `;
      groupMembersSelectList.appendChild(div);
    });
  }
  
  groupCreateModal.classList.remove('hidden');
}

function closeGroupCreator() {
  groupCreateModal.classList.add('hidden');
}

async function handleGroupCreateSubmit(e) {
  e.preventDefault();
  groupCreateError.textContent = '';
  const name = groupNameInput.value.trim();
  if (!name) return;

  const checkedCheckboxes = groupMembersSelectList.querySelectorAll('input[type="checkbox"]:checked');
  const members = Array.from(checkedCheckboxes).map(cb => cb.value);

  try {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        creator: currentUser.username,
        members
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create group');
    }

    closeGroupCreator();
    fetchGroups();
    selectChat(data.id);
  } catch (err) {
    groupCreateError.textContent = err.message;
  }
}

function openGroupSettings() {
  if (!activeChat.startsWith('group_')) return;
  const group = myGroups.find(g => g.id === activeChat);
  if (!group) return;

  groupInfoName.textContent = group.name;
  const date = new Date(group.createdAt).toLocaleDateString();
  groupInfoMeta.textContent = `Created by ${group.createdBy} on ${date}`;

  const currentUserIsAdmin = group.admins.some(a => a.toLowerCase() === currentUser.username.toLowerCase());
  const currentUserIsCreator = group.createdBy.toLowerCase() === currentUser.username.toLowerCase();

  groupInfoMembersList.innerHTML = '';
  group.members.forEach(member => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.justifyContent = 'space-between';
    li.style.padding = '0.5rem 0.75rem';
    li.style.background = 'rgba(255,255,255,0.03)';
    li.style.borderRadius = '8px';
    li.style.border = '1px solid var(--border-color)';
    
    const isMemberAdmin = group.admins.some(a => a.toLowerCase() === member.toLowerCase());
    const isMemberCreator = group.createdBy.toLowerCase() === member.toLowerCase();
    
    let rolesText = '';
    if (isMemberCreator) rolesText = ' <span style="font-size:0.7rem; background:rgba(168,85,247,0.2); color:#a855f7; padding:2px 6px; border-radius:4px; margin-left:0.25rem;">Creator</span>';
    else if (isMemberAdmin) rolesText = ' <span style="font-size:0.7rem; background:rgba(34,197,94,0.2); color:#22c55e; padding:2px 6px; border-radius:4px; margin-left:0.25rem;">Admin</span>';
    
    let actionsHtml = '';
    if (currentUserIsAdmin && member.toLowerCase() !== currentUser.username.toLowerCase()) {
      actionsHtml = '<div style="display:flex; gap:0.35rem;">';
      if (!isMemberAdmin) {
        actionsHtml += `<button class="btn btn-sm" onclick="handleGroupAdminAction('add_admin', '${member}')" style="font-size:0.75rem; padding: 2px 6px; background: rgba(59, 130, 246, 0.12); color:#3b82f6; border:1px solid rgba(59,130,246,0.2); border-radius:4px; cursor:pointer;">Make Admin</button>`;
      }
      actionsHtml += `<button class="btn btn-sm" onclick="handleGroupAdminAction('remove_member', '${member}')" style="font-size:0.75rem; padding: 2px 6px; background: rgba(239, 68, 68, 0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.2); border-radius:4px; cursor:pointer;">Kick</button>`;
      actionsHtml += '</div>';
    }

    li.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span style="font-weight:600; color:white; font-size:0.9rem;">${member}</span>
        ${rolesText}
      </div>
      ${actionsHtml}
    `;
    groupInfoMembersList.appendChild(li);
  });

  if (currentUserIsAdmin) {
    groupInfoAddMemberSection.classList.remove('hidden');
    groupInfoAddMemberSelect.innerHTML = '';
    
    const eligibleToAdd = registeredUsers.filter(u => 
      !group.members.some(m => m.toLowerCase() === u.username.toLowerCase())
    );
    
    if (eligibleToAdd.length === 0) {
      groupInfoAddMemberSelect.innerHTML = '<option value="">No contacts to add</option>';
      groupInfoAddMemberBtn.disabled = true;
    } else {
      groupInfoAddMemberBtn.disabled = false;
      eligibleToAdd.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.username;
        opt.textContent = u.username;
        groupInfoAddMemberSelect.appendChild(opt);
      });
    }
  } else {
    groupInfoAddMemberSection.classList.add('hidden');
  }

  if (currentUserIsCreator) {
    groupDeleteBtn.classList.remove('hidden');
    groupLeaveBtn.classList.add('hidden');
  } else {
    groupDeleteBtn.classList.add('hidden');
    groupLeaveBtn.classList.remove('hidden');
  }

  groupInfoModal.classList.remove('hidden');
}

function closeGroupSettings() {
  groupInfoModal.classList.add('hidden');
}

async function handleGroupAdminAction(action, targetUsername) {
  if (!activeChat.startsWith('group_')) return;
  
  let confirmMsg = '';
  if (action === 'add_admin') confirmMsg = `Promote ${targetUsername} to admin?`;
  else if (action === 'remove_member') confirmMsg = `Kick ${targetUsername} from the group?`;
  else if (action === 'leave') confirmMsg = 'Are you sure you want to leave this group?';
  else if (action === 'delete_group') confirmMsg = 'Are you sure you want to delete this group? All history will be lost.';
  else if (action === 'add_member') confirmMsg = `Add ${targetUsername} to this group?`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/groups/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: activeChat,
        username: currentUser.username,
        action,
        targetUsername
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Admin action failed');
    }

    if (action === 'leave' || action === 'delete_group') {
      closeGroupSettings();
      fetchGroups();
      selectChat('group');
    } else {
      const idx = myGroups.findIndex(g => g.id === activeChat);
      if (idx !== -1) {
        myGroups[idx] = data.group;
      }
      openGroupSettings();
      fetchGroups();
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

window.handleGroupAdminAction = handleGroupAdminAction;

/* --- DYNAMIC NEWS FEED & REELS HANDLERS (FACEBOOK STYLE) --- */
function getUserAvatarUrl(username) {
  if (!username) return null;
  const user = registeredUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
  return user ? user.avatarUrl : null;
}

function getUserAvatarHtml(username, size = 38) {
  const avatarUrl = getUserAvatarUrl(username);
  if (avatarUrl) {
    return `<img src="${avatarUrl}" alt="${escapeHtml(username)}" style="width:${size}px; height:${size}px; min-width:${size}px; min-height:${size}px; object-fit:cover; border-radius:50%; border: 1px solid rgba(255,255,255,0.15);">`;
  } else {
    const letter = username ? username.charAt(0).toUpperCase() : 'U';
    return `<div class="avatar" style="width:${size}px; height:${size}px; min-width:${size}px; min-height:${size}px; font-weight:600; font-size:${size * 0.45}px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:var(--primary-color); color:white; border: 1px solid rgba(255,255,255,0.15);">${letter}</div>`;
  }
}

function switchSidebarNav(tab) {
  if (tab === 'chats') {
    navChatsBtn.className = 'btn btn-sm btn-primary';
    navFeedBtn.className = 'btn btn-sm';
    navFeedBtn.style.background = 'rgba(255,255,255,0.04)';
    navFeedBtn.style.border = '1px solid var(--border-color)';
    navFeedBtn.style.color = 'var(--text-secondary)';

    feedMain.classList.add('hidden');
    chatMain.classList.remove('hidden');

    // Slide sidebar back into view on mobile
    chatContainer.classList.remove('active-chat');
  } else {
    navFeedBtn.className = 'btn btn-sm btn-primary';
    navChatsBtn.className = 'btn btn-sm';
    navChatsBtn.style.background = 'rgba(255,255,255,0.04)';
    navChatsBtn.style.border = '1px solid var(--border-color)';
    navChatsBtn.style.color = 'var(--text-secondary)';

    chatMain.classList.add('hidden');
    feedMain.classList.remove('hidden');

    // Slide social feed into view on mobile
    chatContainer.classList.add('active-chat');
    
    updateAvatarDisplay(feedComposerAvatar, currentUser.username, currentUser.avatarUrl);
    fetchPosts();
  }
}

function switchFeedTab(tab) {
  activeFeedTab = tab;
  if (tab === 'all') {
    feedFilterAllBtn.className = 'btn btn-sm btn-primary';
    feedFilterAllBtn.style.background = '';
    feedFilterAllBtn.style.border = '';
    feedFilterAllBtn.style.color = '';
    
    feedFilterReelsBtn.className = 'btn btn-sm';
    feedFilterReelsBtn.style.background = 'none';
    feedFilterReelsBtn.style.border = 'none';
    feedFilterReelsBtn.style.color = 'var(--text-secondary)';
  } else {
    feedFilterReelsBtn.className = 'btn btn-sm btn-primary';
    feedFilterReelsBtn.style.background = '';
    feedFilterReelsBtn.style.border = '';
    feedFilterReelsBtn.style.color = '';
    
    feedFilterAllBtn.className = 'btn btn-sm';
    feedFilterAllBtn.style.background = 'none';
    feedFilterAllBtn.style.border = 'none';
    feedFilterAllBtn.style.color = 'var(--text-secondary)';
  }
  fetchPosts();
}

async function fetchPosts() {
  const url = activeFeedTab === 'reels' ? '/api/posts?type=video' : '/api/posts';
  try {
    const res = await fetch(url);
    const data = await res.json();
    postsFeed = data;
    renderPostsFeed();
  } catch (err) {
    console.error('Error fetching timeline posts:', err);
  }
}

function renderPostsFeed(posts = postsFeed) {
  feedPostsDisplay.innerHTML = '';
  
  if (posts.length === 0) {
    if (searchQuery.length > 0) {
      feedPostsDisplay.innerHTML = `
        <div class="post-card glass" style="text-align: center; padding: 2.5rem 1rem;">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 2.2rem; color: var(--text-muted); margin-bottom: 0.75rem;"></i>
          <h3 style="color: white; font-size: 1.05rem;">No matching posts found</h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 0.25rem;">Try searching for a different keyword or username</p>
        </div>`;
    } else {
      feedPostsDisplay.innerHTML = `
        <div class="post-card glass" style="text-align: center; padding: 2.5rem 1rem;">
          <i class="fa-solid fa-photo-film" style="font-size: 2.2rem; color: var(--text-muted); margin-bottom: 0.75rem;"></i>
          <h3 style="color: white; font-size: 1.05rem;">No posts or reels yet</h3>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 0.25rem;">Be the first to share a post or video reel!</p>
        </div>`;
    }
    return;
  }

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'post-card glass';
    card.id = `post-${post.id}`;

    const date = new Date(post.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isLiked = post.likes.includes(currentUser.username);
    
    let mediaHtml = '';
    if (post.media) {
      const mime = post.media.type || '';
      if (mime.startsWith('image/')) {
        mediaHtml = `
          <div style="margin: 0.25rem 0;">
            <img class="post-media-image" src="${post.media.url}" alt="${escapeHtml(post.media.name)}" onclick="window.open('${post.media.url}', '_blank')">
          </div>`;
      } else if (mime.startsWith('video/')) {
        mediaHtml = `
          <div class="reel-player-container">
            <span class="reel-badge"><i class="fa-solid fa-clapperboard"></i> Reel</span>
            <video class="reel-video" src="${post.media.url}" autoplay loop muted playsinline></video>
            <div class="reel-overlay-controls">
              <button class="reel-control-btn mute-toggle-btn" onclick="toggleReelMute('${post.id}', event)" title="Mute/Unmute"><i class="fa-solid fa-volume-xmark"></i></button>
              <button class="reel-control-btn play-toggle-btn" onclick="toggleReelPlay('${post.id}', event)" title="Play/Pause"><i class="fa-solid fa-pause"></i></button>
            </div>
          </div>`;
      }
    }

    const likesLabel = `<span id="likes-count-${post.id}">${post.likes.length} Likes</span>`;
    const commentsLabel = `<span id="comments-count-${post.id}">${post.comments.length} Comments</span>`;

    let commentsListHtml = '';
    post.comments.forEach(c => {
      const cTime = new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isCommentOwner = c.author.toLowerCase() === currentUser.username.toLowerCase();
      
      let repliesHtml = '';
      if (c.replies) {
        c.replies.forEach(r => {
          const rTime = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const isReplyOwner = r.author.toLowerCase() === currentUser.username.toLowerCase();
          repliesHtml += `
            <div class="reply-bubble-wrapper" id="reply-container-${r.id}" style="display:flex; gap:8px; align-items:flex-start; margin-bottom:4px;">
              <div onclick="openUserProfileModal('${r.author}')" style="cursor:pointer; display:inline-flex;">
                ${getUserAvatarHtml(r.author, 24)}
              </div>
              <div class="comment-bubble reply-bubble" style="flex:1;">
                <span class="comment-author" onclick="openUserProfileModal('${r.author}')" style="cursor:pointer;">${escapeHtml(r.author)}</span>
                <span class="comment-text">${escapeHtml(r.text)}</span>
                <span class="comment-time">${rTime}</span>
                ${isReplyOwner ? `
                  <button class="delete-comment-btn" onclick="deletePostCommentReply('${post.id}', '${c.id}', '${r.id}', event)" title="Delete Reply"><i class="fa-solid fa-trash-can"></i></button>
                ` : ''}
              </div>
            </div>`;
        });
      }

      commentsListHtml += `
        <div class="comment-item-container" id="comment-container-${c.id}">
          <div class="comment-bubble-wrapper" style="display:flex; gap:8px; align-items:flex-start; margin-bottom:4px;">
            <div onclick="openUserProfileModal('${c.author}')" style="cursor:pointer; display:inline-flex;">
              ${getUserAvatarHtml(c.author, 28)}
            </div>
            <div class="comment-bubble" id="comment-${c.id}" style="flex:1;">
              <span class="comment-author" onclick="openUserProfileModal('${c.author}')" style="cursor:pointer;">${escapeHtml(c.author)}</span>
              <span class="comment-text">${escapeHtml(c.text)}</span>
              <span class="comment-time">${cTime}</span>
              ${isCommentOwner ? `
                <button class="delete-comment-btn" onclick="deletePostComment('${post.id}', '${c.id}', event)" title="Delete Comment"><i class="fa-solid fa-trash-can"></i></button>
              ` : ''}
            </div>
          </div>
          <div class="comment-footer-actions">
            <span class="comment-action-link" onclick="toggleReplyForm('${post.id}', '${c.id}', event)">Reply</span>
          </div>
          <div class="comment-replies-list" id="replies-list-${c.id}">
            ${repliesHtml}
          </div>
        </div>`;
    });

    card.innerHTML = `
      <div class="post-header">
        <div onclick="openUserProfileModal('${post.author}')" style="cursor:pointer; display:inline-flex;">
          ${getUserAvatarHtml(post.author, 38)}
        </div>
        <div style="display:flex; flex-direction:column; gap:0.15rem;">
          <span class="post-author" onclick="openUserProfileModal('${post.author}')" style="cursor:pointer;">${escapeHtml(post.author)}</span>
          <span class="post-time">${date}</span>
        </div>
      </div>
      
      ${post.text ? `<div class="post-text">${escapeHtml(post.text)}</div>` : ''}
      
      ${mediaHtml}

      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-secondary); padding: 0.15rem 0.25rem;">
        ${likesLabel}
        ${commentsLabel}
      </div>

      <div class="post-actions-bar">
        <button class="post-action-btn ${isLiked ? 'active-like' : ''}" id="like-btn-${post.id}" onclick="togglePostLike('${post.id}')">
          <i class="fa-solid fa-thumbs-up"></i> Like
        </button>
        <button class="post-action-btn" onclick="toggleCommentsSection('${post.id}')">
          <i class="fa-solid fa-comment"></i> Comment
        </button>
      </div>

      <div class="post-comments-container hidden" id="comments-section-${post.id}">
        <div class="comments-list-wrapper" id="comments-list-${post.id}">
          ${commentsListHtml || '<div class="no-comments-placeholder" style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding: 0.5rem 0;">No comments yet.</div>'}
        </div>
        <form class="comment-input-composer" onsubmit="submitPostComment(event, '${post.id}')">
          <input type="text" class="comment-input-field" placeholder="Write a comment..." required>
          <button type="submit" class="comment-submit-btn"><i class="fa-solid fa-paper-plane"></i></button>
        </form>
      </div>
    `;

    feedPostsDisplay.appendChild(card);
  });
}

function handleFeedMediaPreselect(e) {
  const file = e.target.files[0];
  if (!file) return;

  composerAttachedFile = file;
  
  feedComposerImgPreview.classList.add('hidden');
  feedComposerVideoPreview.classList.add('hidden');
  feedComposerImgPreview.src = '';
  feedComposerVideoPreview.src = '';
  
  const reader = new FileReader();
  reader.onload = (event) => {
    if (file.type.startsWith('image/')) {
      feedComposerImgPreview.src = event.target.result;
      feedComposerImgPreview.classList.remove('hidden');
    } else if (file.type.startsWith('video/')) {
      feedComposerVideoPreview.src = event.target.result;
      feedComposerVideoPreview.classList.remove('hidden');
    }
    feedComposerPreviewContainer.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearFeedComposerMedia() {
  composerAttachedFile = null;
  feedComposerFileInput.value = '';
  feedComposerImgPreview.src = '';
  feedComposerVideoPreview.src = '';
  feedComposerImgPreview.classList.add('hidden');
  feedComposerVideoPreview.classList.add('hidden');
  feedComposerPreviewContainer.classList.add('hidden');
}

async function handleFeedPostSubmit(e) {
  e.preventDefault();
  const text = feedComposerText.value.trim();
  
  if (!text && !composerAttachedFile) {
    alert('Please enter text or choose a media file to post!');
    return;
  }

  feedComposerSubmitBtn.disabled = true;
  feedComposerSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...';

  let media = null;

  try {
    if (composerAttachedFile) {
      const formData = new FormData();
      formData.append('file', composerAttachedFile);
      
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const fileMeta = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(fileMeta.error || 'Failed to upload post attachment');
      }
      
      media = {
        url: fileMeta.url,
        type: fileMeta.type,
        name: fileMeta.name,
        size: fileMeta.size
      };
    }

    const postRes = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: currentUser.username,
        text,
        media
      })
    });

    const newPost = await postRes.json();
    if (!postRes.ok) {
      throw new Error(newPost.error || 'Failed to publish post');
    }

    feedComposerText.value = '';
    clearFeedComposerMedia();
  } catch (err) {
    alert('Error publishing post: ' + err.message);
  } finally {
    feedComposerSubmitBtn.disabled = false;
    feedComposerSubmitBtn.innerHTML = 'Publish';
  }
}

async function togglePostLike(postId) {
  try {
    const res = await fetch('/api/posts/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId,
        username: currentUser.username
      })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to toggle like');
  } catch (err) {
    console.error('Error toggling post like:', err);
  }
}

function updatePostLikeDOM(postId, likes) {
  const container = document.getElementById(`post-${postId}`);
  if (!container) return;

  const countLabel = document.getElementById(`likes-count-${postId}`);
  if (countLabel) countLabel.textContent = `${likes.length} Likes`;

  const btn = document.getElementById(`like-btn-${postId}`);
  if (btn) {
    const isLiked = likes.includes(currentUser.username);
    if (isLiked) {
      btn.classList.add('active-like');
    } else {
      btn.classList.remove('active-like');
    }
  }
}

function toggleCommentsSection(postId) {
  const section = document.getElementById(`comments-section-${postId}`);
  if (section) {
    section.classList.toggle('hidden');
  }
}

async function submitPostComment(e, postId) {
  e.preventDefault();
  const form = e.target;
  const input = form.querySelector('.comment-input-field');
  const text = input.value.trim();
  if (!text) return;

  const btn = form.querySelector('.comment-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    const res = await fetch('/api/posts/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId,
        author: currentUser.username,
        text
      })
    });

    const comment = await res.json();
    if (!res.ok) throw new Error(comment.error || 'Failed to submit comment');

    input.value = '';
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
  }
}

function updatePostCommentDOM(postId, comment) {
  const commentsList = document.getElementById(`comments-list-${postId}`);
  if (!commentsList) return;

  const placeholder = commentsList.querySelector('.no-comments-placeholder');
  if (placeholder) placeholder.remove();

  const cTime = new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const container = document.createElement('div');
  container.className = 'comment-item-container';
  container.id = `comment-container-${comment.id}`;
  
  const isCommentOwner = comment.author.toLowerCase() === currentUser.username.toLowerCase();

  container.innerHTML = `
    <div class="comment-bubble-wrapper" style="display:flex; gap:8px; align-items:flex-start; margin-bottom:4px;">
      <div onclick="openUserProfileModal('${comment.author}')" style="cursor:pointer; display:inline-flex;">
        ${getUserAvatarHtml(comment.author, 28)}
      </div>
      <div class="comment-bubble" id="comment-${comment.id}" style="flex:1;">
        <span class="comment-author" onclick="openUserProfileModal('${comment.author}')" style="cursor:pointer;">${escapeHtml(comment.author)}</span>
        <span class="comment-text">${escapeHtml(comment.text)}</span>
        <span class="comment-time">${cTime}</span>
        ${isCommentOwner ? `
          <button class="delete-comment-btn" onclick="deletePostComment('${postId}', '${comment.id}', event)" title="Delete Comment"><i class="fa-solid fa-trash-can"></i></button>
        ` : ''}
      </div>
    </div>
    <div class="comment-footer-actions">
      <span class="comment-action-link" onclick="toggleReplyForm('${postId}', '${comment.id}', event)">Reply</span>
    </div>
    <div class="comment-replies-list" id="replies-list-${comment.id}">
    </div>
  `;

  commentsList.appendChild(container);
  commentsList.scrollTop = commentsList.scrollHeight;

  const post = postsFeed.find(p => p.id === postId);
  const countLabel = document.getElementById(`comments-count-${postId}`);
  if (post && countLabel) {
    countLabel.textContent = `${post.comments.length} Comments`;
  }
}

window.toggleReelMute = function(postId, event) {
  event.stopPropagation();
  const container = document.getElementById(`post-${postId}`);
  if (!container) return;
  const video = container.querySelector('.reel-video');
  const btn = container.querySelector('.mute-toggle-btn');
  if (video && btn) {
    video.muted = !video.muted;
    if (video.muted) {
      btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    } else {
      btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
  }
};

window.toggleReelPlay = function(postId, event) {
  event.stopPropagation();
  const container = document.getElementById(`post-${postId}`);
  if (!container) return;
  const video = container.querySelector('.reel-video');
  const btn = container.querySelector('.play-toggle-btn');
  if (video && btn) {
    if (video.paused) {
      video.play();
      btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
      video.pause();
      btn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
  }
};

window.submitPostComment = submitPostComment;
window.togglePostLike = togglePostLike;
window.toggleCommentsSection = toggleCommentsSection;

/* --- COMMENT REPLIES & DELETION HANDLERS --- */
function toggleReplyForm(postId, commentId, event) {
  if (event) event.preventDefault();
  const container = document.getElementById(`comment-container-${commentId}`);
  if (!container) return;

  let form = container.querySelector('.comment-reply-composer-form');
  if (form) {
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      form.querySelector('.comment-input-field').focus();
    }
    return;
  }

  form = document.createElement('form');
  form.className = 'comment-reply-composer-form';
  form.onsubmit = (e) => submitPostCommentReply(e, postId, commentId);
  form.innerHTML = `
    <input type="text" class="comment-input-field" placeholder="Reply to this comment..." required autocomplete="off">
    <button type="submit" class="comment-submit-btn"><i class="fa-solid fa-paper-plane"></i></button>
  `;
  
  const repliesList = document.getElementById(`replies-list-${commentId}`);
  repliesList.parentNode.insertBefore(form, repliesList.nextSibling);
  form.querySelector('.comment-input-field').focus();
}

async function submitPostCommentReply(e, postId, commentId) {
  e.preventDefault();
  const form = e.target;
  const input = form.querySelector('.comment-input-field');
  const text = input.value.trim();
  if (!text) return;

  const btn = form.querySelector('.comment-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    const res = await fetch('/api/posts/comment/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId,
        commentId,
        author: currentUser.username,
        text
      })
    });

    const reply = await res.json();
    if (!res.ok) throw new Error(reply.error || 'Failed to submit reply');

    input.value = '';
    form.classList.add('hidden');
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
  }
}

function updatePostReplyDOM(postId, commentId, reply) {
  const repliesList = document.getElementById(`replies-list-${commentId}`);
  if (!repliesList) return;

  const rTime = new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const wrapper = document.createElement('div');
  wrapper.className = 'reply-bubble-wrapper';
  wrapper.id = `reply-container-${reply.id}`;
  
  const isOwner = reply.author.toLowerCase() === currentUser.username.toLowerCase();

  wrapper.innerHTML = `
    <div onclick="openUserProfileModal('${reply.author}')" style="cursor:pointer; display:inline-flex;">
      ${getUserAvatarHtml(reply.author, 24)}
    </div>
    <div class="comment-bubble reply-bubble" style="flex:1;">
      <span class="comment-author" onclick="openUserProfileModal('${reply.author}')" style="cursor:pointer;">${escapeHtml(reply.author)}</span>
      <span class="comment-text">${escapeHtml(reply.text)}</span>
      <span class="comment-time">${rTime}</span>
      ${isOwner ? `
        <button class="delete-comment-btn" onclick="deletePostCommentReply('${postId}', '${commentId}', '${reply.id}', event)" title="Delete Reply"><i class="fa-solid fa-trash-can"></i></button>
      ` : ''}
    </div>
  `;

  repliesList.appendChild(wrapper);
  repliesList.scrollTop = repliesList.scrollHeight;
}

async function deletePostComment(postId, commentId, event) {
  if (event) event.preventDefault();
  if (!confirm('Delete this comment?')) return;

  try {
    const res = await fetch('/api/posts/comment/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId,
        commentId,
        username: currentUser.username
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete comment');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function deletePostCommentReply(postId, commentId, replyId, event) {
  if (event) event.preventDefault();
  if (!confirm('Delete this reply?')) return;

  try {
    const res = await fetch('/api/posts/comment/reply/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId,
        commentId,
        replyId,
        username: currentUser.username
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete reply');
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

window.submitPostComment = submitPostComment;
window.togglePostLike = togglePostLike;
window.toggleCommentsSection = toggleCommentsSection;
window.toggleReplyForm = toggleReplyForm;
window.deletePostComment = deletePostComment;
window.deletePostCommentReply = deletePostCommentReply;

/* --- SOCIAL SEARCH ENGINE & USER PROFILE MODAL HANDLERS --- */
function handleFeedSearchInput(e) {
  const val = e.target.value.trim();
  searchQuery = val;
  
  if (val.length > 0) {
    feedSearchClearBtn.classList.remove('hidden');
    
    // Filter posts
    const filteredPosts = postsFeed.filter(post => 
      post.author.toLowerCase().includes(val.toLowerCase()) || 
      post.text.toLowerCase().includes(val.toLowerCase())
    );
    renderPostsFeed(filteredPosts);
    
    // Search users
    const matchedUsers = registeredUsers.filter(u => 
      u.username.toLowerCase().includes(val.toLowerCase())
    );
    renderPeopleTray(matchedUsers);
  } else {
    feedSearchClearBtn.classList.add('hidden');
    feedPeopleTray.classList.add('hidden');
    renderPostsFeed();
  }
}

function clearFeedSearch() {
  feedSearchInput.value = '';
  searchQuery = '';
  feedSearchClearBtn.classList.add('hidden');
  feedPeopleTray.classList.add('hidden');
  renderPostsFeed();
}

function renderPeopleTray(users) {
  feedPeopleList.innerHTML = '';
  
  if (users.length === 0) {
    feedPeopleTray.classList.add('hidden');
    return;
  }

  users.forEach(u => {
    const card = document.createElement('div');
    card.className = 'people-card';
    card.onclick = () => openUserProfileModal(u.username);
    
    card.innerHTML = `
      ${getUserAvatarHtml(u.username, 44)}
      <span class="people-name">${escapeHtml(u.username)}</span>
    `;
    feedPeopleList.appendChild(card);
  });
  
  feedPeopleTray.classList.remove('hidden');
}

function openUserProfileModal(username) {
  activeProfileUsername = username;
  
  profileModalAvatarContainer.innerHTML = '';
  profilePostsList.innerHTML = '';
  
  const user = registeredUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
  const bioText = user ? (user.bio || 'No bio written yet') : 'No bio written yet';
  const isOnline = user ? user.online : false;
  
  profileModalAvatarContainer.innerHTML = getUserAvatarHtml(username, 82);
  
  profileModalUsername.textContent = username;
  profileModalStatusBadge.innerHTML = isOnline 
    ? `<span class="status-dot online"></span>Online` 
    : `<span class="status-dot"></span>Offline`;
  
  profileModalBio.textContent = bioText;

  const isMe = username.toLowerCase() === currentUser.username.toLowerCase();
  if (isMe) {
    profileActionMsgBtn.classList.add('hidden');
    profileActionBlockBtn.classList.add('hidden');
  } else {
    profileActionMsgBtn.classList.remove('hidden');
    profileActionBlockBtn.classList.remove('hidden');
    
    const isBlocked = currentUser.blockedUsers && currentUser.blockedUsers.some(
      u => u.toLowerCase() === username.toLowerCase()
    );
    
    if (isBlocked) {
      profileActionBlockBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> Unblock User';
      profileActionBlockBtn.style.background = 'rgba(16, 185, 129, 0.15)';
      profileActionBlockBtn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      profileActionBlockBtn.style.color = '#34d399';
    } else {
      profileActionBlockBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Block User';
      profileActionBlockBtn.style.background = 'rgba(239, 68, 68, 0.15)';
      profileActionBlockBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      profileActionBlockBtn.style.color = '#f87171';
    }
  }

  const userPosts = postsFeed.filter(p => p.author.toLowerCase() === username.toLowerCase());
  renderProfilePosts(userPosts);

  userProfileModal.classList.remove('hidden');
}

function closeUserProfileModal() {
  userProfileModal.classList.add('hidden');
  activeProfileUsername = null;
}

function handleProfileMsgAction() {
  if (!activeProfileUsername) return;
  closeUserProfileModal();
  selectChat(activeProfileUsername);
}

async function handleProfileBlockAction() {
  const isBlocked = currentUser.blockedUsers && currentUser.blockedUsers.some(
    u => u.toLowerCase() === activeProfileUsername.toLowerCase()
  );
  const action = isBlocked ? 'unblock' : 'block';
  const confirmMsg = isBlocked 
    ? `Are you sure you want to unblock ${activeProfileUsername}?`
    : `Are you sure you want to block ${activeProfileUsername}? Blocked users cannot message you.`;

  if (!confirm(confirmMsg)) return;

  profileActionBlockBtn.disabled = true;
  profileActionBlockBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
  
  try {
    await toggleBlockUser(activeProfileUsername, action);
    const stillBlocked = currentUser.blockedUsers.some(
      u => u.toLowerCase() === activeProfileUsername.toLowerCase()
    );
    if (stillBlocked) {
      profileActionBlockBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> Unblock User';
      profileActionBlockBtn.style.background = 'rgba(16, 185, 129, 0.15)';
      profileActionBlockBtn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      profileActionBlockBtn.style.color = '#34d399';
    } else {
      profileActionBlockBtn.innerHTML = '<i class="fa-solid fa-ban"></i> Block User';
      profileActionBlockBtn.style.background = 'rgba(239, 68, 68, 0.15)';
      profileActionBlockBtn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      profileActionBlockBtn.style.color = '#f87171';
    }
  } catch (err) {
    alert('Failed to block/unblock user: ' + err.message);
  } finally {
    profileActionBlockBtn.disabled = false;
  }
}

function renderProfilePosts(posts) {
  profilePostsList.innerHTML = '';
  
  if (posts.length === 0) {
    profilePostsList.innerHTML = `
      <div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1.5rem 0;">
        No posts or reels shared by this user yet.
      </div>`;
    return;
  }

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'post-card glass';
    card.style.padding = '1rem';
    card.style.fontSize = '0.85rem';
    
    const date = new Date(post.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    let mediaHtml = '';
    if (post.media) {
      if (post.media.type.startsWith('image/')) {
        mediaHtml = `<img src="${post.media.url}" style="width:100%; max-height:180px; object-fit:cover; border-radius:8px; margin-top:8px;">`;
      } else if (post.media.type.startsWith('video/')) {
        mediaHtml = `
          <div style="margin-top:8px; font-weight:600; font-size:0.75rem; color:var(--accent-secondary); display:flex; align-items:center; gap:4px;">
            <i class="fa-solid fa-clapperboard"></i> Contains a video Reel
          </div>`;
      }
    }

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-secondary); margin-bottom:6px;">
        <span>${date}</span>
      </div>
      ${post.text ? `<div style="line-height:1.4; color:rgba(255,255,255,0.95);">${escapeHtml(post.text)}</div>` : ''}
      ${mediaHtml}
    `;
    profilePostsList.appendChild(card);
  });
}

window.openUserProfileModal = openUserProfileModal;
window.closeUserProfileModal = closeUserProfileModal;

/* --- TYPING DEBOUNCERS --- */
function showTypingIndicator(text, sender) {
  typingIndicatorText.textContent = text;
  typingIndicatorBox.classList.remove('hidden');
  scrollToBottom();

  clearTimeout(typingTimers.get(sender));
  const timer = setTimeout(() => {
    clearTypingIndicator(sender);
  }, 3000);
  typingTimers.set(sender, timer);
}

function clearTypingIndicator(sender) {
  typingTimers.delete(sender);
  if (typingTimers.size === 0) {
    typingIndicatorBox.classList.add('hidden');
  }
}

/* --- NATIVE AUDIO ALERT CHIME --- */
function playNotificationSound() {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.08); // G5
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn('Browser sound block:', e);
  }
}

/* --- FORMATTERS & HELPERS --- */
function getFileIconClass(mimeType) {
  if (!mimeType) return 'fa-file';
  if (mimeType.includes('pdf')) return 'fa-file-pdf';
  if (mimeType.includes('word') || mimeType.includes('officedocument.wordprocessing')) return 'fa-file-word';
  if (mimeType.includes('excel') || mimeType.includes('officedocument.spreadsheet')) return 'fa-file-excel';
  if (mimeType.includes('powerpoint') || mimeType.includes('officedocument.presentation')) return 'fa-file-powerpoint';
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('tar') || mimeType.includes('rar')) return 'fa-file-zipper';
  if (mimeType.startsWith('audio/')) return 'fa-file-audio';
  if (mimeType.startsWith('text/')) return 'fa-file-lines';
  return 'fa-file';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function scrollToBottom() {
  messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function insertEmoji(emoji) {
  messageInput.value += emoji;
  emojiPicker.classList.add('hidden');
  messageInput.focus();
}
