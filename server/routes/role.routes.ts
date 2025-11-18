import express, { Request, Response } from 'express';
import { authenticate, requireRole } from '@/middleware/auth.middleware';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { ApiResponse } from '@/types';

const router = express.Router();

// Get all roles with permission counts
router.get(
  '/',
  authenticate,
  requireRole('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const roles = await query<any[]>(
        `SELECT role, COUNT(*) as user_count 
         FROM users 
         WHERE is_active = TRUE 
         GROUP BY role`
      );

      res.json({
        success: true,
        data: roles,
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch roles',
      } as ApiResponse);
    }
  }
);

// Get permissions for a role
router.get(
  '/permissions/:role',
  authenticate,
  requireRole('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { role } = req.params;

      const permissions = await query<any[]>(
        'SELECT * FROM role_permissions WHERE role = ?',
        [role]
      );

      res.json({
        success: true,
        data: permissions,
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching role permissions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch role permissions',
      } as ApiResponse);
    }
  }
);

// Update role permissions
router.put(
  '/permissions',
  authenticate,
  requireRole('Admin'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { role, permissions } = req.body;

      if (!role || !Array.isArray(permissions)) {
        res.status(400).json({
          success: false,
          error: 'Role and permissions array are required',
        } as ApiResponse);
        return;
      }

      // Delete existing permissions for the role
      await query('DELETE FROM role_permissions WHERE role = ?', [role]);

      // Insert new permissions
      if (permissions.length > 0) {
        const values = permissions.map((permId) => [role, permId]);
        const placeholders = values.map(() => '(?, ?)').join(', ');
        const flatValues = values.flat();

        await query(
          `INSERT INTO role_permissions (role, permission_id) VALUES ${placeholders}`,
          flatValues
        );
      }

      // Log audit trail
      await logAudit({
        entityType: 'Role',
        entityId: 0,
        action: 'UPDATE_PERMISSIONS',
        newValues: { role, permissions },
        performedBy: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        message: 'Role permissions updated successfully',
      } as ApiResponse);
    } catch (error) {
      console.error('Error updating role permissions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update role permissions',
      } as ApiResponse);
    }
  }
);

export default router;
