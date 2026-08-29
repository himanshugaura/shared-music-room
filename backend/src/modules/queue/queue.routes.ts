import { Router } from 'express';

import { addTrack, getQueue, removeTrack, sortByVotes, voteTrack } from './queue.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.js';
import { addTrackBodySchema, voteBodySchema } from './queue.validations.js';

const router = Router({ mergeParams: true });

router.get('/', authMiddleware, getQueue);
router.post('/tracks', authMiddleware, validate(addTrackBodySchema), addTrack);
router.delete('/tracks/:songId', authMiddleware, removeTrack);
router.post('/tracks/:songId/vote', authMiddleware, validate(voteBodySchema), voteTrack);
router.post('/sort-by-votes', authMiddleware, sortByVotes);

export default router;
