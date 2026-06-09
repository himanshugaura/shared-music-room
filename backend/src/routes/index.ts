import { Router } from 'express';

import authRouter from './auth.routes.js';
import roomRouter from './room.routes.js';
import userRouter from './user.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/rooms', roomRouter);

export default router;
