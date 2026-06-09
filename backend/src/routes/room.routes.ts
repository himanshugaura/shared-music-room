import { Router } from 'express';

import { createRoom, deleteRoom, getRoomDetails,listPublicRooms } from '../controllers/room.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { createRoomBodySchema } from '../validations/room.validations.js';

const router = Router();

router.get('/public', listPublicRooms);

router.post('/', authMiddleware, validate(createRoomBodySchema), createRoom);
router.delete('/:roomId', authMiddleware, deleteRoom);
router.get('/:roomId', authMiddleware, getRoomDetails);

export default router;
