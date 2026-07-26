import { Router } from 'express';

import {
  googleAuth,
  login,
  logout,
  refreshAccessToken,
  register,
} from './auth.controller.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import {
  googleAuthBodySchema,
  loginBodySchema,
  registerBodySchema,
} from './auth.validations.js';

const router = Router();

router.post('/register', authLimiter, validate(registerBodySchema), register);
router.post('/login', authLimiter, validate(loginBodySchema), login);
router.post('/google', authLimiter, validate(googleAuthBodySchema), googleAuth);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);

export default router;
