import { Router } from 'express';

import {
  addTrack,
  getQueue,
  removeTrack,
  updateQueueSettings,
  voteTrack,
} from '../controllers/musicQueue.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.js';
import {
  addTrackBodySchema,
  updateQueueSettingsBodySchema,
  voteBodySchema,
} from '../validations/queue.validations.js';

const router = Router({ mergeParams: true });

router.get('/', authMiddleware, getQueue);
router.post('/tracks', authMiddleware, validate(addTrackBodySchema), addTrack);
router.delete('/tracks/:songId', authMiddleware, removeTrack);
router.post('/tracks/:songId/vote', authMiddleware, validate(voteBodySchema), voteTrack);
router.patch('/settings', authMiddleware, validate(updateQueueSettingsBodySchema), updateQueueSettings);

export default router;
