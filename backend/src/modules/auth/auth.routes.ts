import { Router } from 'express';

import {
  googleAuth,
  login,
  logout,
  refreshAccessToken,
  register,
} from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import {
  googleAuthBodySchema,
  loginBodySchema,
  registerBodySchema,
} from './auth.validations.js';

const router = Router();

router.post('/register', validate(registerBodySchema), register);
router.post('/login', validate(loginBodySchema), login);
router.post('/google', validate(googleAuthBodySchema), googleAuth);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);

export default router;
