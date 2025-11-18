import express, { Request, Response } from 'express';
import { authenticate, requireRole } from '@/middleware/auth.middleware';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';
import { User, ApiResponse } from '@/types';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

const userUploadQueue = new Queue('user-bulk-upload', { connection });

// Get all users (Admin only)
router.get(
  '/',
  authenticate,
  requireRole('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { role, search, is_active } = req.query;

      let sql = `
        SELECT id, username, ad_id, email, mobile, role, business_line, 
               user_code, login_access, is_active, created_at, updated_at
        FROM users
        WHERE 1=1
      `;
      const params: any[] = [];

      if (role) {
        sql += ' AND role = ?';
        params.push(role);
      }

      if (search) {
        sql += ' AND (username LIKE ? OR email LIKE ? OR ad_id LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      if (is_active !== undefined) {
        sql += ' AND is_active = ?';
        params.push(is_active === 'true');
      }

      sql += ' ORDER BY created_at DESC';

      const users = await query<User[]>(sql, params);

      res.json({
        success: true,
        data: users,
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users',
      } as ApiResponse);
    }
  }
);

// Create user (Admin only)
router.post(
  '/',
  authenticate,
  requireRole('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        username,
        ad_id,
        email,
        mobile,
        password,
        role,
        business_line,
        user_code,
        login_access = true,
      } = req.body;

      // Validate required fields
      const errors: string[] = [];
      if (!username) errors.push('Username is required');
      if (!ad_id) errors.push('AD ID is required');
      if (!email) errors.push('Email is required');
      if (!mobile) errors.push('Mobile is required');
      if (!password) errors.push('Password is required');
      if (!role) errors.push('Role is required');

      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors,
        } as ApiResponse);
        return;
      }

      // Check for duplicates
      const existing = await query<any[]>(
        'SELECT id FROM users WHERE username = ? OR ad_id = ? OR email = ?',
        [username, ad_id, email]
      );

      if (existing.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Username, AD ID, or Email already exists',
        } as ApiResponse);
        return;
      }

      // Hash password
      const password_hash = await hashPassword(password);

      // Insert user
      const result: any = await query(
        `INSERT INTO users 
          (username, ad_id, email, mobile, password_hash, role, business_line, user_code, login_access, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
        [username, ad_id, email, mobile, password_hash, role, business_line || null, user_code || null, login_access, req.user!.userId]
      );

      // Log audit trail
      await logAudit({
        entityType: 'User',
        entityId: result.insertId,
        action: 'CREATE',
        newValues: { username, ad_id, email, mobile, role, business_line, user_code, login_access },
        performedBy: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json({
        success: true,
        data: { id: result.insertId, username, role },
        message: 'User created successfully',
      } as ApiResponse);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create user',
      } as ApiResponse);
    }
  }
);

// Update user (Admin only)
router.put(
  '/:id',
  authenticate,
  requireRole('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { email, mobile, role, business_line, user_code, login_access, is_active } = req.body;

      // Get existing user
      const users = await query<User[]>('SELECT * FROM users WHERE id = ?', [id]);

      if (users.length === 0) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        } as ApiResponse);
        return;
      }

      const oldUser = users[0];

      // Update user
      await query(
        `UPDATE users 
         SET email = ?, mobile = ?, role = ?, business_line = ?, user_code = ?, 
             login_access = ?, is_active = ?, updated_by = ?
         WHERE id = ?`,
        [email || oldUser.email, mobile || oldUser.mobile, role || oldUser.role, 
         business_line, user_code, login_access ?? oldUser.login_access, 
         is_active ?? oldUser.is_active, req.user!.userId, id]
      );

      // Log audit trail
      await logAudit({
        entityType: 'User',
        entityId: Number(id),
        action: 'UPDATE',
        oldValues: oldUser,
        newValues: { email, mobile, role, business_line, user_code, login_access, is_active },
        performedBy: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        message: 'User updated successfully',
      } as ApiResponse);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update user',
      } as ApiResponse);
    }
  }
);

// Bulk upload users (Admin only)
router.post(
  '/bulk-upload',
  authenticate,
  requireRole('Admin'),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No file uploaded',
        } as ApiResponse);
        return;
      }

      // Generate unique job ID
      const jobId = uuidv4();
      const filename = req.file.originalname;

      // Get user info
      const users = await query<User[]>('SELECT username FROM users WHERE id = ?', [req.user!.userId]);
      const uploadedByUsername = users[0]?.username || 'Unknown';

      // Create job record in database
      await query(
        `INSERT INTO bulk_upload_jobs (job_id, filename, uploaded_by, uploaded_by_username, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [jobId, filename, req.user!.userId, uploadedByUsername]
      );

      // Add job to queue
      await userUploadQueue.add(
        'process-users',
        {
          jobId,
          filename,
          fileBuffer: req.file.buffer,
          uploadedBy: req.user!.userId,
          uploadedByUsername,
        },
        {
          jobId,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      res.json({
        success: true,
        data: {
          jobId,
          filename,
          status: 'pending',
        },
        message: 'Upload queued for processing',
      } as ApiResponse);
    } catch (error) {
      console.error('Error in bulk upload:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to queue upload',
      } as ApiResponse);
    }
  }
);

// Get upload history
router.get(
  '/upload-history',
  authenticate,
  requireRole('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const history = await query<any[]>(
        `SELECT id, job_id, filename, uploaded_by_username, status, 
                total_records, success_count, error_count, created_at, completed_at
         FROM bulk_upload_jobs
         ORDER BY created_at DESC
         LIMIT 50`
      );

      res.json({
        success: true,
        data: history,
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching upload history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upload history',
      } as ApiResponse);
    }
  }
);

// Get upload job details
router.get(
  '/upload-history/:jobId',
  authenticate,
  requireRole('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;

      const jobs = await query<any[]>(
        `SELECT * FROM bulk_upload_jobs WHERE job_id = ?`,
        [jobId]
      );

      if (jobs.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Upload job not found',
        } as ApiResponse);
        return;
      }

      const job = jobs[0];
      
      // Parse errors JSON if exists
      if (job.errors) {
        try {
          job.errors = JSON.parse(job.errors);
        } catch (e) {
          // Keep as string if parse fails
        }
      }

      res.json({
        success: true,
        data: job,
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching upload job details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch upload job details',
      } as ApiResponse);
    }
  }
);

// Deactivate user (Admin only)
router.post(
  '/:id/deactivate',
  authenticate,
  requireRole('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      await query(
        'UPDATE users SET is_active = FALSE, updated_by = ? WHERE id = ?',
        [req.user!.userId, id]
      );

      await logAudit({
        entityType: 'User',
        entityId: Number(id),
        action: 'DEACTIVATE',
        performedBy: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        message: 'User deactivated successfully',
      } as ApiResponse);
    } catch (error) {
      console.error('Error deactivating user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate user',
      } as ApiResponse);
    }
  }
);

export default router;
