import { Router } from 'express';

import authRouter from './auth/auth.routes.js';
import roomRouter from './room/room.routes.js';
import userRouter from './user/user.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

router.use('/auth', authRouter);
router.use('/user', userRouter);
router.use('/rooms', roomRouter);

export default router;
