// User Types
export type UserRole = 
  | 'Admin' 
  | 'Maker' 
  | 'Checker' 
  | 'Business' 
  | 'BusinessHead' 
  | 'Finance' 
  | 'MIS' 
  | 'Dealer' 
  | 'OEM';

export interface User {
  id: number;
  username: string;
  ad_id: string;
  email: string;
  mobile: string;
  role: UserRole;
  business_line?: string;
  user_code?: string;
  login_access: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

// Dealer Types
export type DealerStatus = 'Pending' | 'Approved' | 'Rejected' | 'Active' | 'Inactive';

export interface Dealer {
  id: number;
  dealer_code: string;
  dealer_name: string;
  gst_number: string;
  pan_number: string;
  state: string;
  email: string;
  mobile: string;
  status: DealerStatus;
  approval_remarks?: string;
  created_at: Date;
  updated_at: Date;
  created_by: number;
  approved_by?: number;
  approved_at?: Date;
}

// Payout Types
export type PayoutCycleStatus = 'Draft' | 'Active' | 'Processing' | 'Completed' | 'Cancelled';

export interface PayoutCycle {
  id: number;
  cycle_name: string;
  cycle_code: string;
  start_date: Date;
  end_date: Date;
  status: PayoutCycleStatus;
  total_cases: number;
  total_amount: number;
  created_at: Date;
  updated_at: Date;
  created_by: number;
}

export type PayoutCaseStatus = 
  | 'New' 
  | 'PayoutGenerated' 
  | 'Held' 
  | 'Released' 
  | 'Cancelled' 
  | 'ApprovedChecker' 
  | 'ApprovedBusiness' 
  | 'InvoiceGenerated'
  | 'InvoiceAccepted'
  | 'Paid';

export interface PayoutCase {
  id: number;
  case_number: string;
  cycle_id: number;
  dealer_id: number;
  payout_type: string;
  base_amount: number;
  incentive_amount: number;
  deduction_amount: number;
  recovery_amount: number;
  net_amount: number;
  status: PayoutCaseStatus;
  hold_reason?: string;
  cancellation_reason?: string;
  bre_calculation?: any;
  raw_data?: any;
  created_at: Date;
  updated_at: Date;
  approved_checker_at?: Date;
  approved_checker_by?: number;
  approved_business_at?: Date;
  approved_business_by?: number;
}

// Invoice Types
export type InvoiceType = 'Payout' | 'OEMSubvention' | 'Recovery';
export type InvoiceStatus = 
  | 'Generated' 
  | 'Pending' 
  | 'Accepted' 
  | 'VendorUploaded' 
  | 'Paid' 
  | 'Overdue' 
  | 'Cancelled';

export interface Invoice {
  id: number;
  invoice_number: string;
  case_id: number;
  dealer_id: number;
  invoice_type: InvoiceType;
  invoice_amount: number;
  gst_amount: number;
  total_amount: number;
  invoice_date: Date;
  due_date: Date;
  status: InvoiceStatus;
  s3_path?: string;
  signed_s3_path?: string;
  aadhaar_verified: boolean;
  aadhaar_otp_verified_at?: Date;
  vendor_uploaded: boolean;
  vendor_uploaded_at?: Date;
  invoice_aging_days: number;
  tat_breached: boolean;
  created_at: Date;
  updated_at: Date;
}

// Payment Types
export type PaymentStatus = 'Pending' | 'Processed' | 'Completed' | 'Failed' | 'Reconciled';
export type ReconciliationStatus = 'Pending' | 'Matched' | 'Mismatched' | 'Unmatched';

export interface Payment {
  id: number;
  payment_ref_number: string;
  invoice_id: number;
  case_id: number;
  dealer_id: number;
  payment_amount: number;
  payment_date: Date;
  utr_number?: string;
  payment_mode?: string;
  bank_reference?: string;
  oracle_fusion_ref?: string;
  status: PaymentStatus;
  reconciliation_status: ReconciliationStatus;
  created_at: Date;
  updated_at: Date;
  created_by: number;
}

// OEM Types
export type OEMPayinType = 'Subvention' | 'Advance' | 'Adjustment';
export type OEMPayinStatus = 
  | 'Pending' 
  | 'ApprovedChecker' 
  | 'ApprovedBusinessHead' 
  | 'InvoiceGenerated'
  | 'InvoiceAccepted'
  | 'Adjusted'
  | 'Completed';

export interface OEMPayin {
  id: number;
  payin_ref_number: string;
  oem_name: string;
  payin_type: OEMPayinType;
  payin_amount: number;
  payin_date: Date;
  status: OEMPayinStatus;
  invoice_number?: string;
  s3_invoice_path?: string;
  adjustment_cycle_id?: number;
  advance_balance: number;
  created_at: Date;
  updated_at: Date;
  created_by: number;
  approved_checker_by?: number;
  approved_businesshead_by?: number;
}

// Dispute Types
export type DisputeType = 'PayoutDispute' | 'InvoiceDispute' | 'OEMDispute' | 'RecoveryDispute';
export type DisputeStatus = 'Open' | 'UnderReview' | 'Approved' | 'Rejected' | 'Resolved' | 'Closed';
export type DisputeRaisedByRole = 'Dealer' | 'OEM' | 'Finance' | 'Business';

export interface Dispute {
  id: number;
  dispute_number: string;
  dispute_type: DisputeType;
  related_entity_type: string;
  related_entity_id: number;
  dealer_id?: number;
  raised_by: number;
  raised_by_role: DisputeRaisedByRole;
  dispute_reason: string;
  disputed_amount?: number;
  supporting_documents?: any;
  status: DisputeStatus;
  resolution_remarks?: string;
  adjustment_cycle_id?: number;
  adjustment_amount?: number;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
  resolved_by?: number;
}

// Audit Trail
export interface AuditTrail {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  old_values?: any;
  new_values?: any;
  remarks?: string;
  ip_address?: string;
  user_agent?: string;
  performed_by: number;
  performed_at: Date;
}

// Service Request Types
export type ServiceRequestType = 
  | 'DealerApproval' 
  | 'PayoutApproval' 
  | 'InvoiceApproval' 
  | 'OEMApproval' 
  | 'DisputeResolution';

export type ServiceRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'InProgress' | 'Completed';

export interface ServiceRequest {
  id: number;
  request_number: string;
  request_type: ServiceRequestType;
  entity_type: string;
  entity_id: number;
  current_stage: string;
  next_stage?: string;
  status: ServiceRequestStatus;
  assigned_to?: number;
  assigned_role?: string;
  remarks?: string;
  created_at: Date;
  updated_at: Date;
  created_by: number;
}

// Upload Job Types
export type UploadJobType = 
  | 'DealerBulkUpload' 
  | 'PayoutDataUpload' 
  | 'PaymentFileUpload' 
  | 'OEMPayinUpload';

export type UploadJobStatus = 
  | 'Queued' 
  | 'Processing' 
  | 'Completed' 
  | 'Failed' 
  | 'PartiallyCompleted';

export interface UploadJob {
  id: number;
  job_id: string;
  job_type: UploadJobType;
  file_name: string;
  file_s3_path?: string;
  status: UploadJobStatus;
  total_records: number;
  processed_records: number;
  success_records: number;
  failed_records: number;
  error_log?: any;
  progress_percentage: number;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  created_by: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: any[];
}

// Permission Types
export interface Permission {
  module: string;
  actions: string[];
}

export interface RolePermissions {
  [key: string]: string[] | boolean;
}
