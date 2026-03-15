import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';
import * as userController from '../controllers/userController.js';
import * as postController from '../controllers/postController.js';
import * as chatController from '../controllers/chatController.js';
import * as voiceController from '../controllers/voiceController.js';
import * as notificationController from '../controllers/notificationController.js';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Multer setup for file uploads
const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /^(audio|image)\//;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio and image files are allowed'));
    }
  },
});

// File upload route
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  (req: AuthenticatedRequest, res: Response): void => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const url = `${BASE_URL}/uploads/${req.file.filename}`;
    res.json({ url });
  }
);

// Auth routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/google/callback', authController.googleAuth);
router.get('/auth/me', authenticateToken, authController.getMe);
router.post('/auth/logout', authenticateToken, authController.logout);

// User routes
router.get('/users/search', optionalAuth, userController.searchUsers);
router.get('/users/:userId', optionalAuth, userController.getUser);
router.put('/users/profile', authenticateToken, userController.updateProfile);
router.post('/users/:userId/follow', authenticateToken, userController.followUser);
router.delete('/users/:userId/follow', authenticateToken, userController.unfollowUser);
router.post('/users/:userId/friend-request', authenticateToken, userController.sendFriendRequest);
router.put('/friendships/:friendshipId', authenticateToken, userController.respondToFriendRequest);
router.get('/friends', authenticateToken, userController.getFriends);
router.get('/friends/pending', authenticateToken, userController.getPendingRequests);

// Post routes
router.post('/posts', authenticateToken, postController.createPost);
router.get('/posts/feed', optionalAuth, postController.getFeed);
router.get('/posts/trending', optionalAuth, postController.getTrendingPosts);
router.get('/posts/popular', optionalAuth, postController.getPopularPosts);
router.get('/posts/search', optionalAuth, postController.searchPosts);
router.get('/posts/:postId', optionalAuth, postController.getPost);
router.patch('/posts/:postId', authenticateToken, postController.editPost);
router.delete('/posts/:postId', authenticateToken, postController.deletePost);
router.get('/users/:userId/posts', optionalAuth, postController.getUserPosts);
router.get('/users/:userId/likes', optionalAuth, postController.getLikedPosts);
router.post('/posts/:postId/like', authenticateToken, postController.likePost);
router.delete('/posts/:postId/like', authenticateToken, postController.unlikePost);
router.post('/posts/:postId/share', authenticateToken, postController.sharePost);
router.get('/posts/:postId/comments', optionalAuth, postController.getComments);
router.post('/posts/:postId/comments', authenticateToken, postController.createComment);

// Chat routes
router.get('/conversations', authenticateToken, chatController.getConversations);
router.post('/conversations', authenticateToken, chatController.getOrCreateConversation);
router.get('/conversations/:conversationId/messages', authenticateToken, chatController.getMessages);
router.post('/conversations/:conversationId/messages', authenticateToken, chatController.sendMessage);
router.put('/conversations/:conversationId/read', authenticateToken, chatController.markAsRead);
router.get('/conversations/:conversationId/members', authenticateToken, chatController.getGroupMembers);
router.post('/conversations/:conversationId/members', authenticateToken, chatController.addGroupMember);
router.delete('/conversations/:conversationId/members/:userId', authenticateToken, chatController.removeGroupMember);

// Voice room routes
router.get('/voice-rooms', optionalAuth, voiceController.getVoiceRooms);
router.post('/voice-rooms', authenticateToken, voiceController.createVoiceRoom);
router.get('/voice-rooms/:roomId', optionalAuth, voiceController.getVoiceRoom);
router.post('/voice-rooms/:roomId/join', authenticateToken, voiceController.joinVoiceRoom);
router.post('/voice-rooms/:roomId/leave', authenticateToken, voiceController.leaveVoiceRoom);
router.delete('/voice-rooms/:roomId', authenticateToken, voiceController.closeVoiceRoom);

// Notification routes
router.get('/notifications', authenticateToken, notificationController.getNotifications);
router.get('/notifications/unread-count', authenticateToken, notificationController.getUnreadCount);
router.put('/notifications/:notificationId/read', authenticateToken, notificationController.markAsRead);
router.put('/notifications/read-all', authenticateToken, notificationController.markAllAsRead);

export default router;
