import { Router } from 'express';

import {
  createRoom,
  deleteRoom,
  getRoomDetails,
  listPublicRooms,
} from '../controllers/room.controller.js';
import { joinRoom, joinRoomByRoomCode } from '../controllers/user.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import queueRouter from './queue.routes.js';
import { createRoomBodySchema } from '../validations/room.validations.js';

const router = Router();

router.get('/public', listPublicRooms);

router.post('/', authMiddleware, validate(createRoomBodySchema), createRoom);
router.get('/:roomId', authMiddleware, getRoomDetails);
router.delete('/:roomId', authMiddleware, deleteRoom);

router.post('/:roomId/join', authMiddleware, joinRoom);
router.post('/join/:roomCode', authMiddleware, joinRoomByRoomCode);

router.use('/:roomId/queue', queueRouter);

export default router;
