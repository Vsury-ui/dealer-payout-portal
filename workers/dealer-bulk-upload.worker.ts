import { Worker, Job } from 'bullmq';
import csv from 'csv-parser';
import fs from 'fs';
import { query } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import redisConnection from '@/lib/redis';
import { QUEUE_NAMES } from './queues';

interface DealerRow {
  dealer_code: string;
  dealer_name: string;
  gst_number: string;
  pan_number: string;
  state: string;
  email: string;
  mobile: string;
}

interface JobData {
  jobId: string;
  filePath: string;
  userId: number;
}

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

const processDealerBulkUpload = async (job: Job<JobData>) => {
  const { jobId, filePath, userId } = job.data;
  const errors: any[] = [];
  let totalRecords = 0;
  let successRecords = 0;
  let failedRecords = 0;

  try {
    // Update job status to Processing
    await query(
      'UPDATE upload_jobs SET status = ?, updated_at = NOW() WHERE job_id = ?',
      ['Processing', jobId]
    );

    const dealers: DealerRow[] = [];

    // Read CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: DealerRow) => {
          dealers.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    totalRecords = dealers.length;

    // Update total records
    await query(
      'UPDATE upload_jobs SET total_records = ? WHERE job_id = ?',
      [totalRecords, jobId]
    );

    // Process each dealer
    for (let i = 0; i < dealers.length; i++) {
      const dealer = dealers[i];
      const rowNumber = i + 2; // +2 for header and 1-based indexing

      try {
        // Validate fields
        const rowErrors: string[] = [];

        if (!dealer.dealer_code) rowErrors.push('Dealer code is required');
        if (!dealer.dealer_name) rowErrors.push('Dealer name is required');
        if (!dealer.gst_number) rowErrors.push('GST number is required');
        else if (!validateGST(dealer.gst_number)) rowErrors.push('Invalid GST format');
        if (!dealer.pan_number) rowErrors.push('PAN number is required');
        else if (!validatePAN(dealer.pan_number)) rowErrors.push('Invalid PAN format');
        if (!dealer.state) rowErrors.push('State is required');
        if (!dealer.email) rowErrors.push('Email is required');
        else if (!validateEmail(dealer.email)) rowErrors.push('Invalid email format');
        if (!dealer.mobile) rowErrors.push('Mobile number is required');
        else if (!validateMobile(dealer.mobile)) rowErrors.push('Invalid mobile number');

        if (rowErrors.length > 0) {
          errors.push({ row: rowNumber, errors: rowErrors });
          failedRecords++;
          continue;
        }

        // Check for duplicate
        const existing = await query<any[]>(
          'SELECT id FROM dealers WHERE dealer_code = ?',
          [dealer.dealer_code]
        );

        if (existing.length > 0) {
          errors.push({
            row: rowNumber,
            errors: [`Dealer code ${dealer.dealer_code} already exists`],
          });
          failedRecords++;
          continue;
        }

        // Insert dealer
        const result: any = await query(
          `INSERT INTO dealers 
            (dealer_code, dealer_name, gst_number, pan_number, state, email, mobile, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
          [
            dealer.dealer_code,
            dealer.dealer_name,
            dealer.gst_number,
            dealer.pan_number,
            dealer.state,
            dealer.email,
            dealer.mobile,
            userId,
          ]
        );

        // Create service request for approval
        const requestNumber = `DLR-BULK-${Date.now()}-${i}`;
        await query(
          `INSERT INTO service_requests 
            (request_number, request_type, entity_type, entity_id, current_stage, next_stage, status, assigned_role, created_by)
           VALUES (?, 'DealerApproval', 'Dealer', ?, 'Created', 'CheckerApproval', 'Pending', 'Checker', ?)`,
          [requestNumber, result.insertId, userId]
        );

        successRecords++;
      } catch (error: any) {
        errors.push({ row: rowNumber, errors: [error.message] });
        failedRecords++;
      }

      // Update progress
      const progress = ((i + 1) / totalRecords) * 100;
      await query(
        'UPDATE upload_jobs SET processed_records = ?, success_records = ?, failed_records = ?, progress_percentage = ? WHERE job_id = ?',
        [i + 1, successRecords, failedRecords, progress.toFixed(2), jobId]
      );

      await job.updateProgress(progress);
    }

    // Update job status to Completed or PartiallyCompleted
    const finalStatus =
      failedRecords === 0 ? 'Completed' : failedRecords === totalRecords ? 'Failed' : 'PartiallyCompleted';

    await query(
      'UPDATE upload_jobs SET status = ?, error_log = ?, completed_at = NOW() WHERE job_id = ?',
      [finalStatus, JSON.stringify(errors), jobId]
    );

    return {
      success: true,
      totalRecords,
      successRecords,
      failedRecords,
      errors,
    };
  } catch (error: any) {
    console.error('Dealer bulk upload error:', error);

    await query(
      'UPDATE upload_jobs SET status = ?, error_log = ?, completed_at = NOW() WHERE job_id = ?',
      ['Failed', JSON.stringify([{ error: error.message }]), jobId]
    );

    throw error;
  }
};

// Create worker
export const dealerBulkUploadWorker = new Worker(
  QUEUE_NAMES.DEALER_BULK_UPLOAD,
  processDealerBulkUpload,
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

dealerBulkUploadWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

dealerBulkUploadWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

export default dealerBulkUploadWorker;
