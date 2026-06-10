import { Router } from 'express';

import { upload } from '../config/multer.js';
import {
  checkUsername,
  getProfile,
  getUserJoinedRooms,
  getUserOwnedRooms,
  joinRoom,
  joinRoomByRoomCode,
  updateProfile,
} from '../controllers/user.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  checkUsernameBodySchema,
  updateProfileBodySchema,
} from '../validations/user.validations.js';

const router = Router();

router.post('/check-username', validate(checkUsernameBodySchema), checkUsername);

router.get('/me', authMiddleware, getProfile);
router.put('/me', authMiddleware, upload.single('avatar'), validate(updateProfileBodySchema), updateProfile);

router.get('/me/rooms/owned', authMiddleware, getUserOwnedRooms);
router.get('/me/rooms/joined', authMiddleware, getUserJoinedRooms);

router.post('/me/rooms/:roomId/join', authMiddleware, joinRoom);
router.post('/me/rooms/join/:roomCode', authMiddleware, joinRoomByRoomCode);

export default router;
