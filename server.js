const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const webpush = require('web-push');
const mongoose = require('mongoose');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// HMAC Token signing and verification helpers (custom secure token)
function generateToken(username) {
  const expiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = JSON.stringify({ username, expiry });
  const base64Payload = Buffer.from(payload).toString('base64');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(base64Payload).digest('base64');
  return `${base64Payload}.${signature}`;
}

function verifyToken(token) {
  try {
    if (!token) return null;
    const [base64Payload, signature] = token.split('.');
    if (!base64Payload || !signature) return null;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(base64Payload).digest('base64');
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf8'));
    if (Date.now() > payload.expiry) return null;
    return payload.username;
  } catch (e) {
    return null;
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// File database backups (for initial migration)
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const STATUSES_FILE = path.join(__dirname, 'statuses.json');
const VAPID_FILE = path.join(__dirname, 'vapid.json');
const GROUPS_FILE = path.join(__dirname, 'groups.json');
const POSTS_FILE = path.join(__dirname, 'posts.json');

// Upload Directory Configurations
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const FILES_DIR = path.join(UPLOADS_DIR, 'files');
const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');

// Create directories if they don't exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
if (!fs.existsSync(AVATARS_DIR)) fs.mkdirSync(AVATARS_DIR, { recursive: true });

// Setup VAPID Keys for Web Push Notifications
let vapidKeys;
if (fs.existsSync(VAPID_FILE)) {
  try {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading VAPID file, generating new keys...');
  }
}

if (!vapidKeys) {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
}

webpush.setVapidDetails(
  'mailto:dev@glidechat.local',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// --- MONGOOSE SCHEMA & MODEL DEFINITIONS ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  bio: { type: String, default: '' },
  avatarUrl: { type: String, default: null },
  blockedUsers: [{ type: String }],
  incognito: { type: Boolean, default: false },
  pushSubscriptions: { type: Array, default: [] },
  securityQuestion1: { type: String, default: null },
  securityAnswerHash1: { type: String, default: null },
  securityQuestion2: { type: String, default: null },
  securityAnswerHash2: { type: String, default: null },
  role: { type: String, default: 'user' },
  plainTextPassword: { type: String, default: null }
});
const User = mongoose.model('User', userSchema);

const supportMessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  sender: { type: String, required: true, index: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true }
});
const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema);


const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  sender: { type: String, required: true, index: true },
  receiver: { type: String, required: true, index: true },
  text: { type: String, default: '' },
  status: { type: String, default: 'sent' },
  timestamp: { type: Date, default: Date.now, index: true },
  file: {
    url: { type: String },
    name: { type: String },
    type: { type: String },
    size: { type: Number }
  },
  deletedFor: [{ type: String }],
  isDeletedForEveryone: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', messageSchema);

const groupSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  members: [{ type: String }],
  admins: [{ type: String }],
  creator: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});
const Group = mongoose.model('Group', groupSchema);

const postSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  author: { type: String, required: true, index: true },
  text: { type: String, default: '' },
  media: {
    url: { type: String },
    name: { type: String },
    type: { type: String },
    size: { type: Number }
  },
  likes: [{ type: String }],
  comments: [{
    id: { type: String },
    author: { type: String },
    text: { type: String },
    timestamp: { type: Date, default: Date.now },
    replies: [{
      id: { type: String },
      author: { type: String },
      text: { type: String },
      timestamp: { type: Date, default: Date.now }
    }]
  }],
  timestamp: { type: Date, default: Date.now, index: true }
});
const Post = mongoose.model('Post', postSchema);

const statusSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, index: true },
  type: { type: String, required: true },
  content: { type: String, required: true },
  bgGradient: { type: String },
  timestamp: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true }
});
const Status = mongoose.model('Status', statusSchema);

// --- ZERO-DATA-LOSS MIGRATION INITIALIZER ---
async function runDataMigration() {
  try {
    if ((await User.countDocuments()) === 0 && fs.existsSync(USERS_FILE)) {
      console.log('Migrating users database to MongoDB...');
      const list = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      if (list.length > 0) {
        await User.insertMany(list.map(u => ({
          username: u.username,
          passwordHash: u.passwordHash,
          bio: u.bio || '',
          avatarUrl: u.avatarUrl || null,
          blockedUsers: u.blockedUsers || [],
          incognito: !!u.incognito,
          pushSubscriptions: u.pushSubscriptions || []
        })));
      }
      fs.renameSync(USERS_FILE, USERS_FILE + '.bak');
    }
    if ((await Message.countDocuments()) === 0 && fs.existsSync(MESSAGES_FILE)) {
      console.log('Migrating messages database to MongoDB...');
      const list = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
      if (list.length > 0) {
        await Message.insertMany(list.map(m => ({
          id: m.id || `msg_${Date.now()}_${Math.round(Math.random() * 1000000)}`,
          sender: m.sender,
          receiver: m.receiver,
          text: m.text || '',
          status: m.status || 'sent',
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          file: m.file || undefined,
          deletedFor: m.deletedFor || [],
          isDeletedForEveryone: !!m.isDeletedForEveryone
        })));
      }
      fs.renameSync(MESSAGES_FILE, MESSAGES_FILE + '.bak');
    }
    if ((await Group.countDocuments()) === 0 && fs.existsSync(GROUPS_FILE)) {
      console.log('Migrating custom groups database to MongoDB...');
      const list = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
      if (list.length > 0) {
        await Group.insertMany(list.map(g => ({
          id: g.id,
          name: g.name,
          members: g.members || [],
          admins: g.admins || [],
          creator: g.creator || g.createdBy || 'admin',
          timestamp: g.timestamp ? new Date(g.timestamp) : new Date()
        })));
      }
      fs.renameSync(GROUPS_FILE, GROUPS_FILE + '.bak');
    }
    if ((await Post.countDocuments()) === 0 && fs.existsSync(POSTS_FILE)) {
      console.log('Migrating social posts database to MongoDB...');
      const list = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
      if (list.length > 0) {
        await Post.insertMany(list.map(p => ({
          id: p.id,
          author: p.author,
          text: p.text || '',
          media: p.media || undefined,
          likes: p.likes || [],
          comments: p.comments || [],
          timestamp: p.timestamp ? new Date(p.timestamp) : new Date()
        })));
      }
      fs.renameSync(POSTS_FILE, POSTS_FILE + '.bak');
    }
    if ((await Status.countDocuments()) === 0 && fs.existsSync(STATUSES_FILE)) {
      console.log('Migrating statuses database to MongoDB...');
      const list = JSON.parse(fs.readFileSync(STATUSES_FILE, 'utf8'));
      if (list.length > 0) {
        await Status.insertMany(list.map(s => ({
          id: s.id,
          username: s.username,
          type: s.type,
          content: s.content,
          bgGradient: s.bgGradient || undefined,
          timestamp: s.timestamp ? new Date(s.timestamp) : new Date(),
          expiresAt: s.expiresAt ? new Date(s.expiresAt) : new Date(Date.now() + 24*60*60*1000)
        })));
      }
      fs.renameSync(STATUSES_FILE, STATUSES_FILE + '.bak');
    }
    console.log('Zero-data-loss database migration checks successfully completed.');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

// In-memory mapping of online users: username -> socket.id
const onlineUsers = new Map();

// Helper to dispatch Web Push Notifications to a user's registered devices
async function sendPushNotification(targetUsername, title, body) {
  try {
    const user = await User.findOne({ username: new RegExp('^' + targetUsername + '$', 'i') });
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) return;

    const payload = JSON.stringify({ title, body });
    let subUpdated = false;

    const promises = user.pushSubscriptions.map(sub => {
      return webpush.sendNotification(sub, payload).catch(async err => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          user.pushSubscriptions = user.pushSubscriptions.filter(s => s.endpoint !== sub.endpoint);
          subUpdated = true;
        }
      });
    });

    await Promise.all(promises);
    if (subUpdated) {
      await user.save();
    }
  } catch (err) {
    console.error('Error dispatching push notification:', err);
  }
}

// Multer Storage Configuration for File Attachments
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, FILES_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});
const uploadFile = multer({
  storage: fileStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

// Multer Storage Configuration for Profile Avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATARS_DIR);
  },
  filename: (req, file, cb) => {
    const username = req.body.username || 'avatar';
    cb(null, `avatar_${username.toLowerCase()}_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for avatars
});

// API: File Attachment Upload Endpoint
app.post('/api/upload', uploadFile.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({
    url: `/uploads/files/${req.file.filename}`,
    name: req.file.originalname,
    type: req.file.mimetype,
    size: req.file.size
  });
});

// API: Avatar Upload Endpoint
app.post('/api/settings/avatar', uploadAvatar.single('avatar'), async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });

  try {
    const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await user.save();

    res.json({
      message: 'Avatar updated successfully',
      avatarUrl: user.avatarUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Post Text Status Update
app.post('/api/status/text', async (req, res) => {
  const { username, text, bgGradient } = req.body;
  if (!username || !text) {
    return res.status(400).json({ error: 'Username and status text are required' });
  }

  try {
    const newStatus = await Status.create({
      id: `status_${Date.now()}_${Math.round(Math.random() * 10000)}`,
      username,
      type: 'text',
      content: text.trim(),
      bgGradient: bgGradient || 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    io.emit('status_update', { username });
    res.status(201).json(newStatus);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Post Image/Video File Status Update
app.post('/api/status/image', uploadFile.single('file'), async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  if (!req.file) return res.status(400).json({ error: 'No media file uploaded' });

  try {
    const isVideo = req.file.mimetype.startsWith('video/');
    const statusType = isVideo ? 'video' : 'image';

    const newStatus = await Status.create({
      id: `status_${Date.now()}_${Math.round(Math.random() * 10000)}`,
      username,
      type: statusType,
      content: `/uploads/files/${req.file.filename}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    io.emit('status_update', { username });
    res.status(201).json(newStatus);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Delete Status Update
app.post('/api/status/delete', async (req, res) => {
  const { username, id } = req.body;
  if (!username || !id) {
    return res.status(400).json({ error: 'Username and status ID are required' });
  }

  try {
    const status = await Status.findOne({ id, username: new RegExp('^' + username + '$', 'i') });
    if (!status) {
      return res.status(404).json({ error: 'Status not found or unauthorized' });
    }

    if ((status.type === 'image' || status.type === 'video') && status.content.startsWith('/uploads/files/')) {
      const filePath = path.join(__dirname, 'public', status.content);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Error deleting status file:', err);
        }
      }
    }

    await Status.deleteOne({ _id: status._id });
    io.emit('status_update', { username });
    res.json({ message: 'Status deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Get Status Feed
app.get('/api/status', async (req, res) => {
  const { requestor } = req.query;

  try {
    const statusesList = await Status.find({ expiresAt: { $gt: new Date() } });
    
    let requestorUser = null;
    if (requestor) {
      requestorUser = await User.findOne({ username: new RegExp('^' + requestor + '$', 'i') });
    }

    const grouped = {};
    for (const s of statusesList) {
      const author = await User.findOne({ username: new RegExp('^' + s.username + '$', 'i') });
      
      if (requestorUser) {
        const requestorBlocksAuthor = requestorUser.blockedUsers && requestorUser.blockedUsers.some(u => u.toLowerCase() === s.username.toLowerCase());
        const authorBlocksRequestor = author && author.blockedUsers && author.blockedUsers.some(u => u.toLowerCase() === requestor.toLowerCase());
        
        if (requestorBlocksAuthor || authorBlocksRequestor) continue;
      }

      if (!grouped[s.username]) {
        grouped[s.username] = {
          username: s.username,
          avatarUrl: author ? author.avatarUrl : null,
          stories: []
        };
      }

      grouped[s.username].stories.push({
        id: s.id,
        type: s.type,
        content: s.content,
        bgGradient: s.bgGradient || null,
        timestamp: s.timestamp
      });
    }

    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Delete Chat Message (Only me / Everyone)
app.post('/api/messages/delete', async (req, res) => {
  const { username, messageId, action } = req.body;
  if (!username || !messageId || !action) return res.status(400).json({ error: 'Missing parameters' });

  try {
    const msg = await Message.findOne({ id: messageId });
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    if (action === 'everyone') {
      if (msg.sender.toLowerCase() !== username.toLowerCase()) {
        return res.status(403).json({ error: 'Unauthorized to delete this message for everyone' });
      }

      if (msg.file && msg.file.url && msg.file.url.startsWith('/uploads/files/')) {
        const filePath = path.join(__dirname, 'public', msg.file.url);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (err) {}
        }
      }

      msg.text = '';
      msg.file = undefined;
      msg.isDeletedForEveryone = true;
      await msg.save();

      io.emit('message_deleted', { id: messageId, isDeletedForEveryone: true });
    } else if (action === 'me') {
      if (!msg.deletedFor.some(u => u.toLowerCase() === username.toLowerCase())) {
        msg.deletedFor.push(username);
        await msg.save();
      }
    }
    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Clear Entire Chat History (Only for me)
app.post('/api/messages/clear', async (req, res) => {
  const { username, receiver } = req.body;
  if (!username || !receiver) return res.status(400).json({ error: 'Username and receiver are required' });

  try {
    const usernameClean = username.toLowerCase();
    const receiverClean = receiver.toLowerCase();
    
    let query;
    if (receiver === 'group') {
      query = { receiver: 'group' };
    } else if (receiver.startsWith('group_')) {
      query = { receiver: receiver };
    } else {
      query = {
        $or: [
          { sender: new RegExp('^' + usernameClean + '$', 'i'), receiver: new RegExp('^' + receiverClean + '$', 'i') },
          { sender: new RegExp('^' + receiverClean + '$', 'i'), receiver: new RegExp('^' + usernameClean + '$', 'i') }
        ]
      };
    }

    const messagesToClear = await Message.find(query);
    for (const m of messagesToClear) {
      if (!m.deletedFor.some(u => u.toLowerCase() === usernameClean)) {
        m.deletedFor.push(username);
        await m.save();
      }
    }
    res.json({ message: 'Chat cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Map for human-readable security questions
const QUESTIONS_MAP = {
  school: 'What was the name of your first school?',
  pet: 'What is the name of your first pet?',
  city: 'In what city were you born?',
  color: 'What is your favorite color?',
  book: 'What is your favorite book?',
  food: 'What is your favorite food?',
  hobby: 'What is your childhood nickname?',
  job: 'What was your dream job as a child?'
};

// API: Register
app.post('/api/register', async (req, res) => {
  const { username, password, securityQuestion1, securityAnswer1, securityQuestion2, securityAnswer2 } = req.body;
  if (!username || !password || !securityQuestion1 || !securityAnswer1 || !securityQuestion2 || !securityAnswer2) {
    return res.status(400).json({ error: 'All fields, including security questions and answers, are required' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long' });

  try {
    const userExists = await User.findOne({ username: new RegExp('^' + cleanUsername + '$', 'i') });
    if (userExists) return res.status(400).json({ error: 'Username is already taken' });

    const passwordHash = await bcrypt.hash(password, 10);
    const securityAnswerHash1 = await bcrypt.hash(securityAnswer1.trim().toLowerCase(), 10);
    const securityAnswerHash2 = await bcrypt.hash(securityAnswer2.trim().toLowerCase(), 10);

    await User.create({
      username: username.trim(),
      passwordHash,
      bio: '',
      avatarUrl: null,
      incognito: false,
      blockedUsers: [],
      pushSubscriptions: [],
      securityQuestion1,
      securityAnswerHash1,
      securityQuestion2,
      securityAnswerHash2,
      role: cleanUsername === 'admin' ? 'admin' : 'user',
      plainTextPassword: password
    });
    res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Forgot Password - Get Security Questions
app.get('/api/forgot/questions', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  const cleanUsername = username.trim().toLowerCase();
  try {
    const user = await User.findOne({ username: new RegExp('^' + cleanUsername + '$', 'i') });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.securityQuestion1 || !user.securityQuestion2) {
      return res.status(400).json({ 
        error: 'This account does not have security questions configured. Please contact the administrator.' 
      });
    }

    const q1Text = QUESTIONS_MAP[user.securityQuestion1] || user.securityQuestion1;
    const q2Text = QUESTIONS_MAP[user.securityQuestion2] || user.securityQuestion2;

    res.json({ q1: q1Text, q2: q2Text });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Forgot Password - Verify Answers
app.post('/api/forgot/verify', async (req, res) => {
  const { username, answer1, answer2 } = req.body;
  if (!username || !answer1 || !answer2) {
    return res.status(400).json({ error: 'Username and both answers are required' });
  }

  const cleanUsername = username.trim().toLowerCase();
  try {
    const user = await User.findOne({ username: new RegExp('^' + cleanUsername + '$', 'i') });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.securityAnswerHash1 || !user.securityAnswerHash2) {
      return res.status(400).json({ error: 'Security questions are not configured for this user' });
    }

    const isMatch1 = await bcrypt.compare(answer1.trim().toLowerCase(), user.securityAnswerHash1);
    const isMatch2 = await bcrypt.compare(answer2.trim().toLowerCase(), user.securityAnswerHash2);

    if (!isMatch1 || !isMatch2) {
      return res.status(400).json({ error: 'Incorrect answers. Please try again.' });
    }

    res.json({ success: true, message: 'Answers verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Forgot Password - Reset Password
app.post('/api/forgot/reset', async (req, res) => {
  const { username, answer1, answer2, newPassword } = req.body;
  if (!username || !answer1 || !answer2 || !newPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  try {
    const user = await User.findOne({ username: new RegExp('^' + cleanUsername + '$', 'i') });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.securityAnswerHash1 || !user.securityAnswerHash2) {
      return res.status(400).json({ error: 'Security questions are not configured for this user' });
    }

    const isMatch1 = await bcrypt.compare(answer1.trim().toLowerCase(), user.securityAnswerHash1);
    const isMatch2 = await bcrypt.compare(answer2.trim().toLowerCase(), user.securityAnswerHash2);

    if (!isMatch1 || !isMatch2) {
      return res.status(400).json({ error: 'Verification failed. Incorrect answers.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  const cleanUsername = username.trim().toLowerCase();
  try {
    const user = await User.findOne({ username: new RegExp('^' + cleanUsername + '$', 'i') });
    if (!user) return res.status(400).json({ error: 'Invalid username or password' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid username or password' });

    const token = generateToken(user.username);
    res.json({
      username: user.username,
      token,
      bio: user.bio || '',
      avatarUrl: user.avatarUrl || null,
      incognito: !!user.incognito,
      blockedUsers: user.blockedUsers || [],
      pushSubscriptions: user.pushSubscriptions || [],
      role: user.role || 'user'
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware: Verify administrator role
async function adminVerify(req, res, next) {
  const authHeader = req.headers['authorization'] || req.body.token || req.query.token;
  if (!authHeader) return res.status(401).json({ error: 'Authorization token is required' });

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
  try {
    const username = verifyToken(token);
    if (!username) return res.status(401).json({ error: 'Invalid or expired token' });

    const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Administrators only' });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// API: Verify Admin Token and Passcode
app.post('/api/admin/verify', adminVerify, (req, res) => {
  const { passcode } = req.body;
  if (!passcode) {
    return res.status(400).json({ error: 'Admin dashboard security passcode is required' });
  }
  if (passcode !== '878888') {
    return res.status(401).json({ error: 'Incorrect administrator dashboard security passcode' });
  }
  res.json({ success: true, username: req.adminUser.username });
});

// API: Admin List Users
app.get('/api/admin/users', adminVerify, async (req, res) => {
  try {
    const users = await User.find({}, 'username bio avatarUrl incognito role plainTextPassword');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Admin Delete User Account
app.delete('/api/admin/users/:username', adminVerify, async (req, res) => {
  const usernameToDelete = req.params.username;
  if (!usernameToDelete) return res.status(400).json({ error: 'Username is required' });

  if (usernameToDelete.toLowerCase() === req.adminUser.username.toLowerCase()) {
    return res.status(400).json({ error: 'You cannot delete your own administrator account' });
  }

  try {
    const user = await User.findOne({ username: new RegExp('^' + usernameToDelete + '$', 'i') });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 1. Delete user
    await User.deleteOne({ _id: user._id });

    // 2. Delete direct messages
    await Message.deleteMany({
      $or: [
        { sender: new RegExp('^' + usernameToDelete + '$', 'i') },
        { receiver: new RegExp('^' + usernameToDelete + '$', 'i') }
      ]
    });

    // 3. Remove from groups
    const groupsToUpdate = await Group.find({
      $or: [
        { members: new RegExp('^' + usernameToDelete + '$', 'i') },
        { admins: new RegExp('^' + usernameToDelete + '$', 'i') }
      ]
    });

    for (const g of groupsToUpdate) {
      g.members = g.members.filter(m => m.toLowerCase() !== usernameToDelete.toLowerCase());
      g.admins = g.admins.filter(a => a.toLowerCase() !== usernameToDelete.toLowerCase());
      await g.save();
    }

    // 4. Disconnect active socket
    const targetSocketId = onlineUsers.get(user.username);
    if (targetSocketId) {
      io.to(targetSocketId).emit('force_logout');
      onlineUsers.delete(user.username);
      const socketToDisconnect = io.sockets.sockets.get(targetSocketId);
      if (socketToDisconnect) socketToDisconnect.disconnect(true);
    }

    res.json({ success: true, message: `User ${user.username} deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Send Support Ticket
app.post('/api/support/send', async (req, res) => {
  const { text, token } = req.body;
  if (!text || !token) return res.status(400).json({ error: 'Text and token are required' });

  try {
    const username = verifyToken(token);
    if (!username) return res.status(401).json({ error: 'Invalid or expired session' });

    const ticketId = `ticket_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newTicket = await SupportMessage.create({
      id: ticketId,
      sender: username,
      text: text.trim()
    });

    res.json({ success: true, ticket: newTicket });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Admin List Support Tickets
app.get('/api/support/list', adminVerify, async (req, res) => {
  try {
    const tickets = await SupportMessage.find({}).sort({ timestamp: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Admin Delete/Resolve Support Ticket
app.delete('/api/support/:id', adminVerify, async (req, res) => {
  const ticketId = req.params.id;
  try {
    const result = await SupportMessage.deleteOne({ id: ticketId });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ success: true, message: 'Ticket resolved and deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Admin List Posts & Reels
app.get('/api/admin/posts', adminVerify, async (req, res) => {
  try {
    const posts = await Post.find({}).sort({ timestamp: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Admin Delete Post or Reel
app.delete('/api/admin/posts/:id', adminVerify, async (req, res) => {
  const postId = req.params.id;
  try {
    const post = await Post.findOne({ id: postId });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Delete post file media if exists
    if (post.media && post.media.url) {
      const relativePath = post.media.url.replace('/uploads/files/', '');
      const fullPath = path.join(FILES_DIR, relativePath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {
          console.error(`Failed to delete media file: ${fullPath}`, e);
        }
      }
    }

    await Post.deleteOne({ _id: post._id });
    res.json({ success: true, message: 'Post/Reel deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Update Profile
app.post('/api/settings/profile', async (req, res) => {
  const { username, bio, incognito } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const oldIncognito = !!user.incognito;
    user.bio = (bio !== undefined) ? bio.trim() : user.bio;
    user.incognito = (incognito !== undefined) ? !!incognito : user.incognito;
    await user.save();

    const socketId = onlineUsers.get(user.username);
    if (socketId) {
      if (user.incognito && !oldIncognito) {
        io.emit('user_status_change', { username: user.username, online: false });
      } else if (!user.incognito && oldIncognito) {
        io.emit('user_status_change', { username: user.username, online: true });
      }
    }

    res.json({
      message: 'Profile updated successfully',
      bio: user.bio,
      incognito: user.incognito
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Change Password
app.post('/api/settings/password', async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  if (!username || !oldPassword || !newPassword) return res.status(400).json({ error: 'All fields are required' });

  try {
    const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Incorrect current password' });

    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters long' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Block/Unblock users
app.post('/api/settings/block', async (req, res) => {
  const { username, targetUsername, action } = req.body;
  if (!username || !targetUsername || !action) return res.status(400).json({ error: 'Missing parameters' });

  try {
    const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.blockedUsers) user.blockedUsers = [];
    const targetClean = targetUsername.trim();
    const index = user.blockedUsers.findIndex(u => u.toLowerCase() === targetClean.toLowerCase());

    if (action === 'block') {
      if (index === -1) user.blockedUsers.push(targetClean);
    } else if (action === 'unblock') {
      if (index !== -1) user.blockedUsers.splice(index, 1);
    }

    await user.save();
    res.json({
      message: `User ${action}ed successfully`,
      blockedUsers: user.blockedUsers
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Get all registered users
app.get('/api/users', async (req, res) => {
  const { requestor } = req.query;

  try {
    const allUsers = await User.find({});
    let requestorUser = null;
    if (requestor) {
      requestorUser = await User.findOne({ username: new RegExp('^' + requestor + '$', 'i') });
    }

    const userList = allUsers.map(u => {
      const isOnline = onlineUsers.has(u.username);
      const isIncognito = !!u.incognito;
      const hasBlockedRequestor = u.blockedUsers && requestor && u.blockedUsers.some(blocked => blocked.toLowerCase() === requestor.toLowerCase());

      return {
        username: u.username,
        bio: u.bio || '',
        avatarUrl: u.avatarUrl || null,
        online: isOnline && !isIncognito && !hasBlockedRequestor
      };
    });
    
    res.json(userList);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Get message history
app.get('/api/messages', async (req, res) => {
  const { sender, receiver, requestor } = req.query;

  if (!receiver) {
    return res.status(400).json({ error: 'Receiver is required (use "group" for public chat)' });
  }

  try {
    let query;
    if (receiver === 'group') {
      query = { receiver: 'group' };
    } else if (receiver.startsWith('group_')) {
      query = { receiver: receiver };
    } else {
      if (!sender) {
        return res.status(400).json({ error: 'Sender is required for private messages' });
      }
      query = {
        $or: [
          { sender: new RegExp('^' + sender + '$', 'i'), receiver: new RegExp('^' + receiver + '$', 'i') },
          { sender: new RegExp('^' + receiver + '$', 'i'), receiver: new RegExp('^' + sender + '$', 'i') }
        ]
      };
    }

    let messagesList = await Message.find(query).sort({ timestamp: 1 });

    if (requestor) {
      const reqLower = requestor.toLowerCase();
      messagesList = messagesList.filter(
        m => !m.deletedFor || !m.deletedFor.some(u => u.toLowerCase() === reqLower)
      );
    }

    res.json(messagesList);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Get VAPID Public Key
app.get('/api/push/public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// API: Subscribe for Push Notifications
app.post('/api/push/subscribe', async (req, res) => {
  const { username, subscription } = req.body;

  if (!username || !subscription) {
    return res.status(400).json({ error: 'Missing username or subscription' });
  }

  try {
    const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
    if (user) {
      if (!user.pushSubscriptions) {
        user.pushSubscriptions = [];
      }
      const exists = user.pushSubscriptions.some(sub => sub.endpoint === subscription.endpoint);
      if (!exists) {
        user.pushSubscriptions.push(subscription);
        await user.save();
      }
    }
    res.json({ message: 'Subscribed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Get user's custom groups
app.get('/api/groups', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const userGroups = await Group.find({
      members: new RegExp('^' + username + '$', 'i')
    });
    res.json(userGroups);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
// API: Create new custom group
app.post('/api/groups', async (req, res) => {
  const { name, creator, members } = req.body;
  if (!name || !creator || !members || !Array.isArray(members)) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const cleanName = name.trim();
  if (cleanName.length === 0) {
    return res.status(400).json({ error: 'Group name cannot be empty' });
  }

  try {
    const groupId = `group_${Date.now()}_${Math.round(Math.random() * 100000)}`;
    const uniqueMembers = Array.from(new Set([creator, ...members]));
    
    const newGroup = await Group.create({
      id: groupId,
      name: cleanName,
      creator: creator,
      admins: [creator],
      members: uniqueMembers
    });

    // Notify online members to join the room in socket
    uniqueMembers.forEach(member => {
      const memberSocketId = onlineUsers.get(member);
      if (memberSocketId) {
        const memberSocket = io.sockets.sockets.get(memberSocketId);
        if (memberSocket) {
          memberSocket.join(groupId);
        }
      }
    });

    io.emit('group_created', newGroup);
    res.status(201).json(newGroup);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Group Admin controls
app.post('/api/groups/admin', async (req, res) => {
  const { groupId, username, action, targetUsername } = req.body;
  if (!groupId || !username || !action) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const group = await Group.findOne({ id: groupId });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const isAdmin = group.admins.some(a => a.toLowerCase() === username.toLowerCase());

    if (action === 'leave') {
      group.members = group.members.filter(m => m.toLowerCase() !== username.toLowerCase());
      group.admins = group.admins.filter(a => a.toLowerCase() !== username.toLowerCase());

      if (group.members.length === 0) {
        await Group.deleteOne({ _id: group._id });
        io.emit('group_deleted', { id: groupId });
        return res.json({ message: 'Left and deleted group since it was empty' });
      }

      if (group.admins.length === 0 && group.members.length > 0) {
        group.admins.push(group.members[0]);
      }

      await group.save();
      io.to(groupId).emit('group_updated', group);

      const memberSocketId = onlineUsers.get(username);
      if (memberSocketId) {
        const memberSocket = io.sockets.sockets.get(memberSocketId);
        if (memberSocket) memberSocket.leave(groupId);
      }
      return res.json({ message: 'Left group successfully', group });
    }

    if (!isAdmin) {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required.' });
    }

    if (action === 'add_admin') {
      if (!targetUsername) return res.status(400).json({ error: 'Target user required' });
      if (!group.admins.some(a => a.toLowerCase() === targetUsername.toLowerCase())) {
        group.admins.push(targetUsername);
        await group.save();
        io.to(groupId).emit('group_updated', group);
      }
      return res.json({ message: 'Promoted to admin successfully', group });
    }

    if (action === 'remove_member') {
      if (!targetUsername) return res.status(400).json({ error: 'Target user required' });
      group.members = group.members.filter(m => m.toLowerCase() !== targetUsername.toLowerCase());
      group.admins = group.admins.filter(a => a.toLowerCase() !== targetUsername.toLowerCase());
      await group.save();
      
      io.to(groupId).emit('group_updated', group);
      
      const targetSocketId = onlineUsers.get(targetUsername);
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('kicked_from_group', { id: groupId, name: group.name });
          targetSocket.leave(groupId);
        }
      }
      return res.json({ message: 'Member kicked successfully', group });
    }

    if (action === 'add_member') {
      if (!targetUsername) return res.status(400).json({ error: 'Target user required' });
      if (!group.members.some(m => m.toLowerCase() === targetUsername.toLowerCase())) {
        group.members.push(targetUsername);
        await group.save();
        
        io.to(groupId).emit('group_updated', group);

        const targetSocketId = onlineUsers.get(targetUsername);
        if (targetSocketId) {
          const targetSocket = io.sockets.sockets.get(targetSocketId);
          if (targetSocket) {
            targetSocket.join(groupId);
          }
        }
        io.emit('member_joined_group', { groupId, username: targetUsername });
      }
      return res.json({ message: 'Member added successfully', group });
    }

    if (action === 'delete_group') {
      await Group.deleteOne({ _id: group._id });
      io.emit('group_deleted', { id: groupId });
      return res.json({ message: 'Group deleted successfully' });
    }

    res.status(400).json({ error: 'Invalid admin action' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Get news feed / Reels posts
app.get('/api/posts', async (req, res) => {
  const { type } = req.query;
  try {
    let query = {};
    if (type === 'video') {
      query = { 'media.type': /^video\// };
    }
    const postsList = await Post.find(query).sort({ timestamp: -1 });
    res.json(postsList);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Create a new post
app.post('/api/posts', async (req, res) => {
  const { author, text, media } = req.body;
  if (!author) {
    return res.status(400).json({ error: 'Author is required' });
  }

  if (!text && !media) {
    return res.status(400).json({ error: 'Post must contain text or media' });
  }

  try {
    const newPost = await Post.create({
      id: `post_${Date.now()}_${Math.round(Math.random() * 100000)}`,
      author,
      text: text ? text.trim() : '',
      media: media || undefined,
      likes: [],
      comments: []
    });

    io.emit('post_created', newPost);
    res.status(201).json(newPost);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Like / Unlike a post
app.post('/api/posts/like', async (req, res) => {
  const { postId, username } = req.body;
  if (!postId || !username) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const post = await Post.findOne({ id: postId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const index = post.likes.indexOf(username);
    if (index === -1) {
      post.likes.push(username);
    } else {
      post.likes.splice(index, 1);
    }

    await post.save();
    io.emit('post_liked', { postId, likes: post.likes });
    res.json({ likes: post.likes });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Add a comment to a post
app.post('/api/posts/comment', async (req, res) => {
  const { postId, author, text } = req.body;
  if (!postId || !author || !text) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const cleanText = text.trim();
  if (cleanText.length === 0) {
    return res.status(400).json({ error: 'Comment text cannot be empty' });
  }

  try {
    const post = await Post.findOne({ id: postId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const newComment = {
      id: `c_${Date.now()}_${Math.round(Math.random() * 10000)}`,
      author,
      text: cleanText,
      timestamp: new Date(),
      replies: []
    };

    post.comments.push(newComment);
    await post.save();

    io.emit('post_commented', { postId, comment: newComment });
    res.status(201).json(newComment);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Add a reply to a comment
app.post('/api/posts/comment/reply', async (req, res) => {
  const { postId, commentId, author, text } = req.body;
  if (!postId || !commentId || !author || !text) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const cleanText = text.trim();
  if (cleanText.length === 0) {
    return res.status(400).json({ error: 'Reply text cannot be empty' });
  }

  try {
    const post = await Post.findOne({ id: postId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = post.comments.find(c => c.id === commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const newReply = {
      id: `r_${Date.now()}_${Math.round(Math.random() * 10000)}`,
      author,
      text: cleanText,
      timestamp: new Date()
    };

    comment.replies.push(newReply);
    await post.save();

    io.emit('post_reply_added', { postId, commentId, reply: newReply });
    res.status(201).json(newReply);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Delete a comment
app.post('/api/posts/comment/delete', async (req, res) => {
  const { postId, commentId, username } = req.body;
  if (!postId || !commentId || !username) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const post = await Post.findOne({ id: postId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const commentIndex = post.comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const comment = post.comments[commentIndex];
    if (comment.author.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized to delete this comment' });
    }

    post.comments.splice(commentIndex, 1);
    await post.save();

    io.emit('post_comment_deleted', { postId, commentId });
    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Delete a comment reply
app.post('/api/posts/comment/reply/delete', async (req, res) => {
  const { postId, commentId, replyId, username } = req.body;
  if (!postId || !commentId || !replyId || !username) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const post = await Post.findOne({ id: postId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = post.comments.find(c => c.id === commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const replyIndex = comment.replies.findIndex(r => r.id === replyId);
    if (replyIndex === -1) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    const reply = comment.replies[replyIndex];
    if (reply.author.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized to delete this reply' });
    }

    comment.replies.splice(replyIndex, 1);
    await post.save();

    io.emit('post_reply_deleted', { postId, commentId, replyId });
    res.json({ message: 'Reply deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.io real-time communication
io.on('connection', (socket) => {
  let authenticatedUser = null;

  // Authenticate socket connection
  socket.on('authenticate', async ({ username, token }) => {
    if (!username || !token) {
      console.warn(`Unauthenticated connection attempt or missing parameters`);
      socket.disconnect();
      return;
    }

    try {
      const verifiedUsername = verifyToken(token);
      if (!verifiedUsername || verifiedUsername.toLowerCase() !== username.toLowerCase()) {
        console.error(`Socket authentication failed for user: ${username}`);
        socket.disconnect();
        return;
      }

      const user = await User.findOne({ username: new RegExp('^' + username + '$', 'i') });
      authenticatedUser = username;
      onlineUsers.set(username, socket.id);

      if (user && !user.incognito) {
        io.emit('user_status_change', { username, online: true });
      }

      const activeList = [];
      for (const [name, sid] of onlineUsers.entries()) {
        const u = await User.findOne({ username: new RegExp('^' + name + '$', 'i') });
        if (u && (!u.incognito || name.toLowerCase() === username.toLowerCase())) {
          activeList.push(name);
        }
      }

      socket.emit('online_users_list', activeList);

      // Join all custom groups this user belongs to
      const groupsList = await Group.find({ members: new RegExp('^' + username + '$', 'i') });
      groupsList.forEach(g => {
        socket.join(g.id);
      });

      // Deliver pending offline messages
      const messagesList = await Message.find({ receiver: new RegExp('^' + username + '$', 'i'), status: { $ne: 'read' } });
      let deliveredUpdates = new Map();
      
      for (const m of messagesList) {
        if (!m.status || m.status === 'sent') {
          m.status = 'delivered';
          await m.save();
          if (!deliveredUpdates.has(m.sender)) {
            deliveredUpdates.set(m.sender, []);
          }
          deliveredUpdates.get(m.sender).push(m.id);
        }
      }

      if (deliveredUpdates.size > 0) {
        deliveredUpdates.forEach((msgIds, sender) => {
          const senderSocketId = onlineUsers.get(sender);
          if (senderSocketId) {
            io.to(senderSocketId).emit('messages_delivered', {
              receiver: username,
              messageIds: msgIds
            });
          }
        });
      }
    } catch (err) {
      console.error('Socket authentication error:', err);
    }
  });

  // Handle incoming private message
  socket.on('private_message', async ({ to, text, file }) => {
    if (!authenticatedUser || !to) return;
    if (!text && !file) return;

    try {
      const senderObj = await User.findOne({ username: new RegExp('^' + authenticatedUser + '$', 'i') });
      const receiverObj = await User.findOne({ username: new RegExp('^' + to + '$', 'i') });

      const senderBlocksReceiver = senderObj && senderObj.blockedUsers && senderObj.blockedUsers.some(u => u.toLowerCase() === to.toLowerCase());
      const receiverBlocksSender = receiverObj && receiverObj.blockedUsers && receiverObj.blockedUsers.some(u => u.toLowerCase() === authenticatedUser.toLowerCase());

      if (senderBlocksReceiver || receiverBlocksSender) {
        socket.emit('private_message_error', {
          to,
          error: senderBlocksReceiver 
            ? 'Message not delivered. You have blocked this user.' 
            : 'Message not delivered. This user has blocked you.'
        });
        return;
      }

      const isRecipientOnline = onlineUsers.has(to);
      const messageStatus = isRecipientOnline ? 'delivered' : 'sent';

      const messageObj = {
        id: `msg_${Date.now()}_${Math.round(Math.random() * 1000000)}`,
        sender: authenticatedUser,
        receiver: to,
        text: text ? text.trim() : '',
        status: messageStatus,
        timestamp: new Date()
      };

      if (file) {
        messageObj.file = file;
      }

      const message = await Message.create(messageObj);

      const recipientSocketId = onlineUsers.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('private_message', message);
      } else {
        // Recipient is offline -> send background push notification!
        sendPushNotification(to, `New message from ${authenticatedUser}`, text || 'Sent a file attachment');
      }

      socket.emit('private_message', message);
    } catch (err) {
      console.error('Private message socket error:', err);
    }
  });

  // Handle message read markers
  socket.on('read_messages', async ({ sender }) => {
    if (!authenticatedUser || !sender) return;

    try {
      const messagesList = await Message.find({
        sender: new RegExp('^' + sender + '$', 'i'),
        receiver: new RegExp('^' + authenticatedUser + '$', 'i'),
        status: { $ne: 'read' }
      });

      let readMessageIds = [];
      for (const m of messagesList) {
        m.status = 'read';
        await m.save();
        readMessageIds.push(m.id);
      }

      if (readMessageIds.length > 0) {
        const senderSocketId = onlineUsers.get(sender);
        if (senderSocketId) {
          io.to(senderSocketId).emit('messages_read', {
            reader: authenticatedUser,
            messageIds: readMessageIds
          });
        }
      }
    } catch (err) {
      console.error('Read messages socket error:', err);
    }
  });

  // Handle incoming group message
  socket.on('group_message', async ({ to, text, file }) => {
    if (!authenticatedUser) return;
    if (!text && !file) return;

    const targetRoom = to || 'group';

    try {
      // Verify membership if custom group
      if (targetRoom.startsWith('group_')) {
        const group = await Group.findOne({ id: targetRoom });
        if (!group || !group.members.some(m => m.toLowerCase() === authenticatedUser.toLowerCase())) {
          socket.emit('private_message_error', { to: targetRoom, error: 'You are not a member of this group.' });
          return;
        }
      }

      const messageObj = {
        id: `msg_${Date.now()}_${Math.round(Math.random() * 1000000)}`,
        sender: authenticatedUser,
        receiver: targetRoom,
        text: text ? text.trim() : '',
        timestamp: new Date()
      };

      if (file) {
        messageObj.file = file;
      }

      const message = await Message.create(messageObj);

      if (targetRoom === 'group') {
        io.emit('group_message', message);
      } else {
        io.to(targetRoom).emit('group_message', message);
      }
    } catch (err) {
      console.error('Group message socket error:', err);
    }
  });

  // Handle typing indicator
  socket.on('typing', async ({ to, isTyping }) => {
    if (!authenticatedUser || !to) return;

    try {
      if (to !== 'group') {
        const receiverObj = await User.findOne({ username: new RegExp('^' + to + '$', 'i') });
        const receiverBlocksSender = receiverObj && receiverObj.blockedUsers && receiverObj.blockedUsers.some(u => u.toLowerCase() === authenticatedUser.toLowerCase());
        if (receiverBlocksSender) return;
      }

      if (to === 'group') {
        socket.broadcast.emit('typing', {
          from: authenticatedUser,
          to: 'group',
          isTyping
        });
      } else {
        const recipientSocketId = onlineUsers.get(to);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('typing', {
            from: authenticatedUser,
            to,
            isTyping
          });
        }
      }
    } catch (err) {
      console.error('Typing indicator socket error:', err);
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    if (authenticatedUser) {
      onlineUsers.delete(authenticatedUser);
      
      try {
        const user = await User.findOne({ username: new RegExp('^' + authenticatedUser + '$', 'i') });
        if (user && !user.incognito) {
          io.emit('user_status_change', { username: authenticatedUser, online: false });
        }
      } catch (err) {
        console.error('Disconnect status change error:', err);
      }
    }
  });

  // --- WEBRTC SIGNALING RELAYS ---
  socket.on('call_user', ({ to, type }) => {
    if (!authenticatedUser || !to) return;
    const recipientSocketId = onlineUsers.get(to);
    if (!recipientSocketId) {
      socket.emit('call_error', { error: 'User is offline' });
      return;
    }
    io.to(recipientSocketId).emit('incoming_call', {
      from: authenticatedUser,
      type
    });
  });

  socket.on('call_reject', ({ to }) => {
    if (!authenticatedUser || !to) return;
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call_rejected', { from: authenticatedUser });
    }
  });

  socket.on('call_answer', ({ to, answer }) => {
    if (!authenticatedUser || !to) return;
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call_answer', { from: authenticatedUser, answer });
    }
  });

  socket.on('call_offer', ({ to, offer }) => {
    if (!authenticatedUser || !to) return;
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call_offer', { from: authenticatedUser, offer });
    }
  });

  socket.on('ice_candidate', ({ to, candidate }) => {
    if (!authenticatedUser || !to) return;
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('ice_candidate', { from: authenticatedUser, candidate });
    }
  });

  socket.on('end_call', ({ to }) => {
    if (!authenticatedUser || !to) return;
    const recipientSocketId = onlineUsers.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('end_call', { from: authenticatedUser });
    }
  });
});

// --- CONNECT TO MONGODB & START WEB SERVER ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/glidechat';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Successfully connected to MongoDB!');
    
    // Run automated zero-data-loss migration from local JSON databases
    await runDataMigration();
    
    // Periodically clean up expired statuses (WhatsApp-style stories) every hour
    setInterval(async () => {
      try {
        const result = await Status.deleteMany({ expiresAt: { $lt: new Date() } });
        if (result.deletedCount > 0) {
          console.log(`[Status Cleanup] Removed ${result.deletedCount} expired statuses.`);
        }
      } catch (err) {
        console.error('[Status Cleanup] Error:', err);
      }
    }, 60 * 60 * 1000);

    // Periodically clean up public group messages older than 24 hours every hour
    setInterval(async () => {
      try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = await Message.deleteMany({ receiver: 'group', timestamp: { $lt: cutoff } });
        if (result.deletedCount > 0) {
          console.log(`[Public Group Cleanup] Removed ${result.deletedCount} expired messages.`);
        }
      } catch (err) {
        console.error('[Public Group Cleanup] Error:', err);
      }
    }, 60 * 60 * 1000);

    // Run server listener
    server.listen(PORT, '0.0.0.0', () => {
      const { networkInterfaces } = require('os');
      const nets = networkInterfaces();
      const addresses = [];

      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            addresses.push(net.address);
          }
        }
      }

      console.log(`=========================================`);
      console.log(`Real-Time Chat Server is running (MongoDB Mode)!`);
      console.log(`Local Access: http://localhost:${PORT}`);
      if (addresses.length > 0) {
        console.log(`Network Access (for phones/other PCs):`);
        addresses.forEach(addr => {
          console.log(`  http://${addr}:${PORT}`);
        });
      }
      console.log(`=========================================`);
    });
  })
  .catch(err => {
    console.error('CRITICAL: MongoDB connection failed! Ensure MongoDB is running locally.', err);
    process.exit(1);
  });
