import express, { Request, Response } from 'express';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { Dealer, ApiResponse, User } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

const dealerUploadQueue = new Queue('dealer-bulk-upload-new', { connection });

// Validation functions
const validateGST = (gst: string): boolean => {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst);
};

const validatePAN = (pan: string): boolean => {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
};

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validateMobile = (mobile: string): boolean => {
  return /^[0-9]{10}$/.test(mobile);
};

// Get all dealers
router.get(
  '/',
  authenticate,
  authorize('dealers', 'view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, search, page = '1', limit = '10' } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let sql = `
        SELECT d.*, 
               u1.username as created_by_username,
               u2.username as approved_by_username
        FROM dealers d
        LEFT JOIN users u1 ON d.created_by = u1.id
        LEFT JOIN users u2 ON d.approved_by = u2.id
        WHERE 1=1
      `;
      const countParams: any[] = [];
      const dataParams: any[] = [];

      if (status) {
        sql += ' AND d.status = ?';
        countParams.push(status);
        dataParams.push(status);
      }

      if (search) {
        sql += ' AND (d.dealer_code LIKE ? OR d.dealer_name LIKE ? OR d.gst_number LIKE ?)';
        const searchPattern = `%${search}%`;
        countParams.push(searchPattern, searchPattern, searchPattern);
        dataParams.push(searchPattern, searchPattern, searchPattern);
      }

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM dealers d WHERE 1=1` + 
        (status ? ' AND d.status = ?' : '') + 
        (search ? ' AND (d.dealer_code LIKE ? OR d.dealer_name LIKE ? OR d.gst_number LIKE ?)' : '');
      const countResult = await query<any[]>(countSql, countParams);
      const total = countResult[0].total;

      // Use direct values for LIMIT and OFFSET as mysql2 doesn't handle them well as prepared statement params
      sql += ` ORDER BY d.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;

      const dealers = await query<Dealer[]>(sql, dataParams);

      res.json({
        success: true,
        data: dealers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching dealers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dealers',
      } as ApiResponse);
    }
  }
);

// Get dealer by ID
router.get(
  '/:id',
  authenticate,
  authorize('dealers', 'view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const dealers = await query<Dealer[]>(
        `SELECT d.*, 
                u1.username as created_by_username,
                u2.username as approved_by_username
         FROM dealers d
         LEFT JOIN users u1 ON d.created_by = u1.id
         LEFT JOIN users u2 ON d.approved_by = u2.id
         WHERE d.id = ?`,
        [id]
      );

      if (dealers.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Dealer not found',
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: dealers[0],
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching dealer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dealer',
      } as ApiResponse);
    }
  }
);

// Create dealer
router.post(
  '/',
  authenticate,
  authorize('dealers', 'create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        dealer_code,
        dealer_name,
        gst_number,
        pan_number,
        state,
        email,
        mobile,
      } = req.body;

      // Validate required fields
      const errors: string[] = [];

      if (!dealer_code) errors.push('Dealer code is required');
      if (!dealer_name) errors.push('Dealer name is required');
      if (!gst_number) errors.push('GST number is required');
      else if (!validateGST(gst_number)) errors.push('Invalid GST format');
      if (!pan_number) errors.push('PAN number is required');
      else if (!validatePAN(pan_number)) errors.push('Invalid PAN format');
      if (!state) errors.push('State is required');
      if (!email) errors.push('Email is required');
      else if (!validateEmail(email)) errors.push('Invalid email format');
      if (!mobile) errors.push('Mobile number is required');
      else if (!validateMobile(mobile)) errors.push('Invalid mobile number (10 digits required)');

      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors,
        } as ApiResponse);
        return;
      }

      // Check for duplicate dealer code
      const existing = await query<Dealer[]>(
        'SELECT id FROM dealers WHERE dealer_code = ?',
        [dealer_code]
      );

      if (existing.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Dealer code already exists',
        } as ApiResponse);
        return;
      }

      // Insert dealer
      const result: any = await query(
        `INSERT INTO dealers 
          (dealer_code, dealer_name, gst_number, pan_number, state, email, mobile, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
        [dealer_code, dealer_name, gst_number, pan_number, state, email, mobile, req.user!.userId]
      );

      // Create service request for approval
      const requestNumber = `DLR-${Date.now()}-${uuidv4().substring(0, 8)}`;
      await query(
        `INSERT INTO service_requests 
          (request_number, request_type, entity_type, entity_id, current_stage, next_stage, status, assigned_role, created_by)
         VALUES (?, 'DealerApproval', 'Dealer', ?, 'Created', 'CheckerApproval', 'Pending', 'Checker', ?)`,
        [requestNumber, result.insertId, req.user!.userId]
      );

      // Log audit trail
      await logAudit({
        entityType: 'Dealer',
        entityId: result.insertId,
        action: 'CREATE',
        newValues: { dealer_code, dealer_name, gst_number, pan_number, state, email, mobile },
        performedBy: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json({
        success: true,
        data: { id: result.insertId, dealer_code, status: 'Pending' },
        message: 'Dealer created successfully and sent for approval',
      } as ApiResponse);
    } catch (error) {
      console.error('Error creating dealer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create dealer',
      } as ApiResponse);
    }
  }
);

// Approve/Reject dealer
router.post(
  '/:id/approve',
  authenticate,
  authorize('dealers', 'approve'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { action, remarks } = req.body;

      if (!action || !['approve', 'reject'].includes(action)) {
        res.status(400).json({
          success: false,
          error: 'Valid action (approve/reject) is required',
        } as ApiResponse);
        return;
      }

      if (action === 'reject' && !remarks) {
        res.status(400).json({
          success: false,
          error: 'Remarks are required for rejection',
        } as ApiResponse);
        return;
      }

      // Get dealer
      const dealers = await query<Dealer[]>('SELECT * FROM dealers WHERE id = ?', [id]);

      if (dealers.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Dealer not found',
        } as ApiResponse);
        return;
      }

      const dealer = dealers[0];

      if (dealer.status !== 'Pending') {
        res.status(400).json({
          success: false,
          error: 'Dealer is not in pending state',
        } as ApiResponse);
        return;
      }

      const newStatus = action === 'approve' ? 'Approved' : 'Rejected';

      // Update dealer
      await query(
        `UPDATE dealers 
         SET status = ?, approval_remarks = ?, approved_by = ?, approved_at = NOW()
         WHERE id = ?`,
        [newStatus, remarks || null, req.user!.userId, id]
      );

      // Update service request
      await query(
        `UPDATE service_requests 
         SET status = ?, remarks = ?
         WHERE entity_type = 'Dealer' AND entity_id = ?`,
        [action === 'approve' ? 'Approved' : 'Rejected', remarks || null, id]
      );

      // Log audit trail
      await logAudit({
        entityType: 'Dealer',
        entityId: Number(id),
        action: action.toUpperCase(),
        oldValues: { status: dealer.status },
        newValues: { status: newStatus, remarks },
        performedBy: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        message: `Dealer ${action}d successfully`,
      } as ApiResponse);
    } catch (error) {
      console.error('Error approving/rejecting dealer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process approval',
      } as ApiResponse);
    }
  }
);

// Get pending approvals for Checker dashboard
router.get(
  '/pending-approvals',
  authenticate,
  authorize('dealers', 'approve'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const dealers = await query<Dealer[]>(
        `SELECT d.*, 
                u1.username as created_by_username
         FROM dealers d
         LEFT JOIN users u1 ON d.created_by = u1.id
         WHERE d.status = 'Pending'
         ORDER BY d.created_at ASC`
      );

      res.json({
        success: true,
        data: dealers,
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pending approvals',
      } as ApiResponse);
    }
  }
);

// Bulk approve/reject dealers
router.post(
  '/bulk-approve',
  authenticate,
  authorize('dealers', 'approve'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { dealer_ids, action, remarks } = req.body;

      if (!dealer_ids || !Array.isArray(dealer_ids) || dealer_ids.length === 0) {
        res.status(400).json({
          success: false,
          error: 'dealer_ids array is required',
        } as ApiResponse);
        return;
      }

      if (!action || !['approve', 'reject'].includes(action)) {
        res.status(400).json({
          success: false,
          error: 'Valid action (approve/reject) is required',
        } as ApiResponse);
        return;
      }

      if (action === 'reject' && !remarks) {
        res.status(400).json({
          success: false,
          error: 'Remarks are required for rejection',
        } as ApiResponse);
        return;
      }

      const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
      let successCount = 0;
      let failedCount = 0;

      for (const dealerId of dealer_ids) {
        try {
          // Get dealer
          const dealers = await query<Dealer[]>('SELECT * FROM dealers WHERE id = ?', [dealerId]);

          if (dealers.length === 0 || dealers[0].status !== 'Pending') {
            failedCount++;
            continue;
          }

          const dealer = dealers[0];

          // Update dealer
          await query(
            `UPDATE dealers 
             SET status = ?, approval_remarks = ?, approved_by = ?, approved_at = NOW()
             WHERE id = ?`,
            [newStatus, remarks || null, req.user!.userId, dealerId]
          );

          // Update service request
          await query(
            `UPDATE service_requests 
             SET status = ?, remarks = ?
             WHERE entity_type = 'Dealer' AND entity_id = ?`,
            [action === 'approve' ? 'Approved' : 'Rejected', remarks || null, dealerId]
          );

          // Log audit trail
          await logAudit({
            entityType: 'Dealer',
            entityId: dealerId,
            action: `BULK_${action.toUpperCase()}`,
            oldValues: { status: dealer.status },
            newValues: { status: newStatus, remarks },
            performedBy: req.user!.userId,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          });

          successCount++;
        } catch (error) {
          console.error(`Error processing dealer ${dealerId}:`, error);
          failedCount++;
        }
      }

      res.json({
        success: true,
        data: { successCount, failedCount },
        message: `Bulk ${action} completed: ${successCount} successful, ${failedCount} failed`,
      } as ApiResponse);
    } catch (error) {
      console.error('Error in bulk approve/reject:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process bulk approval',
      } as ApiResponse);
    }
  }
);

// Bulk upload dealers
router.post(
  '/bulk-upload',
  authenticate,
  authorize('dealers', 'create'),
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
        `INSERT INTO dealer_bulk_upload_jobs (job_id, filename, uploaded_by, uploaded_by_username, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [jobId, filename, req.user!.userId, uploadedByUsername]
      );

      // Add job to queue
      await dealerUploadQueue.add(
        'process-dealers',
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
  authorize('dealers', 'view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const history = await query<any[]>(
        `SELECT id, job_id, filename, uploaded_by_username, status, 
                total_records, success_count, error_count, created_at, completed_at
         FROM dealer_bulk_upload_jobs
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
  authorize('dealers', 'view'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;

      const jobs = await query<any[]>(
        `SELECT * FROM dealer_bulk_upload_jobs WHERE job_id = ?`,
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

export default router;
