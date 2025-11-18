import { query } from './db';
import { AuditTrail } from '@/types';

export const logAudit = async (params: {
  entityType: string;
  entityId: number;
  action: string;
  oldValues?: any;
  newValues?: any;
  remarks?: string;
  ipAddress?: string;
  userAgent?: string;
  performedBy: number;
}): Promise<void> => {
  try {
    await query(
      `INSERT INTO audit_trail 
        (entity_type, entity_id, action, old_values, new_values, remarks, ip_address, user_agent, performed_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.entityType,
        params.entityId,
        params.action,
        params.oldValues ? JSON.stringify(params.oldValues) : null,
        params.newValues ? JSON.stringify(params.newValues) : null,
        params.remarks || null,
        params.ipAddress || null,
        params.userAgent || null,
        params.performedBy,
      ]
    );
  } catch (error) {
    console.error('Failed to log audit trail:', error);
    // Don't throw - audit logging should not break the main flow
  }
};

export const getAuditTrail = async (
  entityType: string,
  entityId: number
): Promise<AuditTrail[]> => {
  return query<AuditTrail[]>(
    `SELECT at.*, u.username, u.role 
     FROM audit_trail at
     JOIN users u ON at.performed_by = u.id
     WHERE at.entity_type = ? AND at.entity_id = ?
     ORDER BY at.performed_at DESC`,
    [entityType, entityId]
  );
};
