import express, { Request, Response } from 'express';
import { authenticate, authorize } from '@/middleware/auth.middleware';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { PayoutCycle, PayoutCase, ApiResponse } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { payoutDataUploadQueue, addJob } from '../../workers/queues';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Get all payout cycles
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.query;

      let sql = `
        SELECT pc.*, u.username as created_by_username
        FROM payout_cycles pc
        LEFT JOIN users u ON pc.created_by = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status) {
        sql += ' AND pc.status = ?';
        params.push(status);
      }

      sql += ' ORDER BY pc.created_at DESC';

      const cycles = await query<PayoutCycle[]>(sql, params);

      res.json({
        success: true,
        data: cycles,
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching payout cycles:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payout cycles',
      } as ApiResponse);
    }
  }
);

// Create payout cycle
router.post(
  '/',
  authenticate,
  authorize('payoutCycles', 'create'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { cycle_name, start_date, end_date } = req.body;

      // Validation
      const errors: string[] = [];
      if (!cycle_name) errors.push('Cycle name is required');
      if (!start_date) errors.push('Start date is required');
      if (!end_date) errors.push('End date is required');

      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors,
        } as ApiResponse);
        return;
      }

      // Generate cycle code
      const cycle_code = `CYC-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      // Insert cycle
      const result: any = await query(
        `INSERT INTO payout_cycles 
          (cycle_name, cycle_code, start_date, end_date, status, created_by)
         VALUES (?, ?, ?, ?, 'Draft', ?)`,
        [cycle_name, cycle_code, start_date, end_date, req.user!.userId]
      );

      await logAudit({
        entityType: 'PayoutCycle',
        entityId: result.insertId,
        action: 'CREATE',
        newValues: { cycle_name, cycle_code, start_date, end_date },
        performedBy: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.status(201).json({
        success: true,
        data: { id: result.insertId, cycle_code, cycle_name },
        message: 'Payout cycle created successfully',
      } as ApiResponse);
    } catch (error) {
      console.error('Error creating payout cycle:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create payout cycle',
      } as ApiResponse);
    }
  }
);

// Upload payout data CSV
router.post(
  '/:cycleId/upload',
  authenticate,
  authorize('payoutCycles', 'upload'),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { cycleId } = req.params;

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'CSV file is required',
        } as ApiResponse);
        return;
      }

      // Check if cycle exists
      const cycles = await query<PayoutCycle[]>(
        'SELECT * FROM payout_cycles WHERE id = ?',
        [cycleId]
      );

      if (cycles.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Payout cycle not found',
        } as ApiResponse);
        return;
      }

      // Create upload job
      const jobId = uuidv4();
      await query(
        `INSERT INTO upload_jobs 
          (job_id, job_type, file_name, status, created_by)
         VALUES (?, 'PayoutDataUpload', ?, 'Queued', ?)`,
        [jobId, req.file.originalname, req.user!.userId]
      );

      // Add job to BullMQ
      await addJob(payoutDataUploadQueue, 'payout-data-upload', {
        jobId,
        cycleId: Number(cycleId),
        filePath: req.file.path,
        userId: req.user!.userId,
      });

      res.json({
        success: true,
        data: { jobId },
        message: 'Payout data upload queued successfully',
      } as ApiResponse);
    } catch (error) {
      console.error('Error uploading payout data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload payout data',
      } as ApiResponse);
    }
  }
);

// Get payout cases for a cycle
router.get(
  '/:cycleId/cases',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { cycleId } = req.params;
      const { status, dealer_id } = req.query;

      let sql = `
        SELECT pc.*, d.dealer_name, d.dealer_code
        FROM payout_cases pc
        LEFT JOIN dealers d ON pc.dealer_id = d.id
        WHERE pc.cycle_id = ?
      `;
      const params: any[] = [cycleId];

      if (status) {
        sql += ' AND pc.status = ?';
        params.push(status);
      }

      if (dealer_id) {
        sql += ' AND pc.dealer_id = ?';
        params.push(dealer_id);
      }

      sql += ' ORDER BY pc.created_at DESC';

      const cases = await query<PayoutCase[]>(sql, params);

      res.json({
        success: true,
        data: cases,
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching payout cases:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch payout cases',
      } as ApiResponse);
    }
  }
);

// Update case status (Hold/Release/Cancel)
router.post(
  '/cases/:caseId/status',
  authenticate,
  authorize('payoutCases', 'hold'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId } = req.params;
      const { action, reason } = req.body;

      const validActions = ['hold', 'release', 'cancel'];
      if (!validActions.includes(action)) {
        res.status(400).json({
          success: false,
          error: 'Invalid action. Must be hold, release, or cancel',
        } as ApiResponse);
        return;
      }

      // Get existing case
      const cases = await query<PayoutCase[]>(
        'SELECT * FROM payout_cases WHERE id = ?',
        [caseId]
      );

      if (cases.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Payout case not found',
        } as ApiResponse);
        return;
      }

      const oldCase = cases[0];
      let newStatus = oldCase.status;
      let updateFields: any = {};

      switch (action) {
        case 'hold':
          newStatus = 'Held';
          updateFields = { hold_reason: reason };
          break;
        case 'release':
          newStatus = 'Released';
          updateFields = { hold_reason: null };
          break;
        case 'cancel':
          newStatus = 'Cancelled';
          updateFields = { cancellation_reason: reason };
          break;
      }

      // Update case
      await query(
        `UPDATE payout_cases 
         SET status = ?, ${Object.keys(updateFields).map(k => `${k} = ?`).join(', ')}
         WHERE id = ?`,
        [newStatus, ...Object.values(updateFields), caseId]
      );

      await logAudit({
        entityType: 'PayoutCase',
        entityId: Number(caseId),
        action: action.toUpperCase(),
        oldValues: { status: oldCase.status },
        newValues: { status: newStatus, ...updateFields },
        performedBy: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        message: `Case ${action}ed successfully`,
      } as ApiResponse);
    } catch (error) {
      console.error('Error updating case status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update case status',
      } as ApiResponse);
    }
  }
);

// Approve payout cases (Checker)
router.post(
  '/cases/:caseId/approve',
  authenticate,
  authorize('payoutCases', 'approve'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId } = req.params;
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

      const cases = await query<PayoutCase[]>(
        'SELECT * FROM payout_cases WHERE id = ?',
        [caseId]
      );

      if (cases.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Payout case not found',
        } as ApiResponse);
        return;
      }

      const newStatus = action === 'approve' ? 'ApprovedChecker' : 'Cancelled';

      await query(
        `UPDATE payout_cases 
         SET status = ?, approved_checker_by = ?, approved_checker_at = NOW()
         WHERE id = ?`,
        [newStatus, req.user!.userId, caseId]
      );

      await logAudit({
        entityType: 'PayoutCase',
        entityId: Number(caseId),
        action: `CHECKER_${action.toUpperCase()}`,
        newValues: { status: newStatus, remarks },
        performedBy: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        message: `Case ${action}d by checker successfully`,
      } as ApiResponse);
    } catch (error) {
      console.error('Error approving case:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve case',
      } as ApiResponse);
    }
  }
);

export default router;
