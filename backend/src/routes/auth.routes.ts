import { Router } from 'express';

import {
  googleAuth,
  login,
  logout,
  refreshAccessToken,
  register,
  sendVerificationEmail,
  verifyEmail,
} from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import { googleAuthBodySchema,loginBodySchema, registerBodySchema } from '../validations/auth.validations.js';

const router = Router();

router.post('/register', validate(registerBodySchema), register);
router.post('/login', validate(loginBodySchema), login);
router.post('/google', validate(googleAuthBodySchema), googleAuth);
router.post('/refresh', refreshAccessToken);
router.get('/verify-email', verifyEmail);

router.post('/logout', authMiddleware, logout);
router.post('/send-verification', sendVerificationEmail);

export default router;
