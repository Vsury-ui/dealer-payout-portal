import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { query } from '../lib/db';
import { logAudit } from '../lib/audit';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

dotenv.config();

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
});

interface UploadJobData {
  jobId: string;
  filename: string;
  fileBuffer: Buffer;
  uploadedBy: number;
  uploadedByUsername: string;
}

interface RowError {
  row: number;
  data: any;
  error: string;
}

const processDealerBulkUpload = async (job: Job<UploadJobData>) => {
  const { jobId, filename, fileBuffer, uploadedBy, uploadedByUsername } = job.data;

  try {
    // Update job status to processing
    await query(
      'UPDATE dealer_bulk_upload_jobs SET status = ? WHERE job_id = ?',
      ['processing', jobId]
    );

    const results: any[] = [];
    const errors: RowError[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Convert buffer to readable stream
    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null);

    // Parse CSV
    await new Promise((resolve, reject) => {
      bufferStream
        .pipe(csvParser())
        .on('data', (row) => results.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Processing ${results.length} dealer records for job ${jobId}`);

    // Update total records
    await query(
      'UPDATE dealer_bulk_upload_jobs SET total_records = ? WHERE job_id = ?',
      [results.length, jobId]
    );

    // Process each row
    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      const rowNumber = i + 2; // +2 because of header and 0-indexed

      try {
        const {
          dealer_code,
          dealer_name,
          gst_number,
          pan_number,
          state,
          email,
          mobile,
          address,
          city,
          pincode,
          bank_name,
          account_number,
          ifsc_code,
          branch,
        } = row;

        // Validate required fields
        if (!dealer_code || !dealer_name || !gst_number || !pan_number || !state || !email || !mobile) {
          errors.push({
            row: rowNumber,
            data: row,
            error: 'Missing required fields (dealer_code, dealer_name, gst_number, pan_number, state, email, mobile)',
          });
          errorCount++;
          continue;
        }

        // Check for duplicates
        const existing = await query<any[]>(
          'SELECT id FROM dealers WHERE dealer_code = ? OR gst_number = ? OR pan_number = ?',
          [dealer_code, gst_number, pan_number]
        );

        if (existing.length > 0) {
          errors.push({
            row: rowNumber,
            data: row,
            error: 'Duplicate dealer_code, GST number, or PAN number',
          });
          errorCount++;
          continue;
        }

        // Insert dealer
        const result: any = await query(
          `INSERT INTO dealers 
            (dealer_code, dealer_name, gst_number, pan_number, state, email, mobile, 
             address, city, pincode, bank_name, account_number, ifsc_code, branch, 
             status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`,
          [
            dealer_code,
            dealer_name,
            gst_number.toUpperCase(),
            pan_number.toUpperCase(),
            state,
            email,
            mobile,
            address || null,
            city || null,
            pincode || null,
            bank_name || null,
            account_number || null,
            ifsc_code || null,
            branch || null,
            uploadedBy,
          ]
        );

        // Log audit trail
        await logAudit({
          entityType: 'Dealer',
          entityId: result.insertId,
          action: 'CREATE',
          newValues: { dealer_code, dealer_name, gst_number, pan_number, state },
          performedBy: uploadedBy,
          ipAddress: null,
          userAgent: 'Bulk Upload Worker',
        });

        successCount++;

        // Update progress periodically
        if (successCount % 10 === 0) {
          await query(
            'UPDATE dealer_bulk_upload_jobs SET success_count = ?, error_count = ? WHERE job_id = ?',
            [successCount, errorCount, jobId]
          );
          await job.updateProgress((i + 1) / results.length * 100);
        }
      } catch (error: any) {
        errors.push({
          row: rowNumber,
          data: row,
          error: error.message,
        });
        errorCount++;
      }
    }

    // Update final job status
    const finalStatus = errorCount === results.length ? 'failed' : 'completed';
    await query(
      `UPDATE dealer_bulk_upload_jobs 
       SET status = ?, success_count = ?, error_count = ?, errors = ?, completed_at = NOW() 
       WHERE job_id = ?`,
      [finalStatus, successCount, errorCount, JSON.stringify(errors.slice(0, 100)), jobId]
    );

    console.log(
      `Job ${jobId} completed: ${successCount} success, ${errorCount} errors`
    );

    return {
      jobId,
      successCount,
      errorCount,
      totalRecords: results.length,
    };
  } catch (error: any) {
    console.error(`Error processing job ${jobId}:`, error);

    // Mark job as failed
    await query(
      `UPDATE dealer_bulk_upload_jobs 
       SET status = ?, errors = ?, completed_at = NOW() 
       WHERE job_id = ?`,
      ['failed', JSON.stringify([{ error: error.message }]), jobId]
    );

    throw error;
  }
};

// Create worker
const worker = new Worker('dealer-bulk-upload-new', processDealerBulkUpload, {
  connection,
  concurrency: 2,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 100 },
});

worker.on('completed', (job) => {
  console.log(`Dealer upload job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Dealer upload job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('Dealer upload worker error:', err);
});

console.log('Dealer bulk upload worker started');

export default worker;
