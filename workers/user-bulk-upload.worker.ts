import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { query } from '../lib/db';
import { hashPassword } from '../lib/auth';
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

const processUserBulkUpload = async (job: Job<UploadJobData>) => {
  const { jobId, filename, fileBuffer, uploadedBy, uploadedByUsername } = job.data;

  try {
    // Update job status to processing
    await query(
      'UPDATE bulk_upload_jobs SET status = ? WHERE job_id = ?',
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

    console.log(`Processing ${results.length} records for job ${jobId}`);

    // Update total records
    await query(
      'UPDATE bulk_upload_jobs SET total_records = ? WHERE job_id = ?',
      [results.length, jobId]
    );

    // Process each row
    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      const rowNumber = i + 2; // +2 because of header and 0-indexed

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
          login_access,
        } = row;

        // Validate required fields
        if (!username || !ad_id || !email || !mobile || !password || !role) {
          errors.push({
            row: rowNumber,
            data: row,
            error: 'Missing required fields',
          });
          errorCount++;
          continue;
        }

        // Check for duplicates
        const existing = await query<any[]>(
          'SELECT id FROM users WHERE username = ? OR ad_id = ? OR email = ?',
          [username, ad_id, email]
        );

        if (existing.length > 0) {
          errors.push({
            row: rowNumber,
            data: row,
            error: 'Duplicate username, AD ID, or email',
          });
          errorCount++;
          continue;
        }

        // Hash password
        const password_hash = await hashPassword(password);

        // Insert user
        const result: any = await query(
          `INSERT INTO users 
            (username, ad_id, email, mobile, password_hash, role, business_line, user_code, login_access, is_active, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
          [
            username,
            ad_id,
            email,
            mobile,
            password_hash,
            role,
            business_line || null,
            user_code || null,
            login_access === 'TRUE' || login_access === 'true' || login_access === true,
            uploadedBy,
          ]
        );

        // Log audit trail
        await logAudit({
          entityType: 'User',
          entityId: result.insertId,
          action: 'CREATE',
          newValues: { username, ad_id, email, mobile, role },
          performedBy: uploadedBy,
          ipAddress: null,
          userAgent: 'Bulk Upload Worker',
        });

        successCount++;

        // Update progress periodically
        if (successCount % 10 === 0) {
          await query(
            'UPDATE bulk_upload_jobs SET success_count = ?, error_count = ? WHERE job_id = ?',
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
      `UPDATE bulk_upload_jobs 
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
      `UPDATE bulk_upload_jobs 
       SET status = ?, errors = ?, completed_at = NOW() 
       WHERE job_id = ?`,
      ['failed', JSON.stringify([{ error: error.message }]), jobId]
    );

    throw error;
  }
};

// Create worker
const worker = new Worker('user-bulk-upload', processUserBulkUpload, {
  connection,
  concurrency: 2, // Process 2 uploads concurrently
  removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
  removeOnFail: { count: 100 }, // Keep last 100 failed jobs
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('User bulk upload worker started');

export default worker;
