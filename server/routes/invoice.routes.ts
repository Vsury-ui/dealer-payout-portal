import express from 'express';
import { authenticate } from '@/middleware/auth.middleware';

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  res.json({ success: true, data: [], message: 'Invoice routes - To be implemented' });
});

export default router;
