import { Worker, Job } from 'bullmq';
import csv from 'csv-parser';
import fs from 'fs';
import { query } from '@/lib/db';
import redisConnection from '@/lib/redis';
import { QUEUE_NAMES } from './queues';
import { v4 as uuidv4 } from 'uuid';

interface PayoutDataRow {
  dealer_code: string;
  payout_type: string;
  base_amount: string;
  incentive_amount: string;
  deduction_amount?: string;
  recovery_amount?: string;
}

interface JobData {
  jobId: string;
  cycleId: number;
  filePath: string;
  userId: number;
}

// Mock BRE Engine - Calculate payout based on rules
const applyBRECalculation = (row: PayoutDataRow) => {
  const base = parseFloat(row.base_amount) || 0;
  const incentive = parseFloat(row.incentive_amount) || 0;
  const deduction = parseFloat(row.deduction_amount || '0') || 0;
  const recovery = parseFloat(row.recovery_amount || '0') || 0;

  // Mock BRE rules - you can expand this
  let calculatedIncentive = incentive;
  
  // Example rule: 10% bonus if base amount > 100000
  if (base > 100000) {
    calculatedIncentive = incentive * 1.1;
  }

  // Example rule: Cap incentive at 20% of base
  const maxIncentive = base * 0.20;
  if (calculatedIncentive > maxIncentive) {
    calculatedIncentive = maxIncentive;
  }

  const netAmount = base + calculatedIncentive - deduction - recovery;

  return {
    base_amount: base,
    incentive_amount: calculatedIncentive,
    deduction_amount: deduction,
    recovery_amount: recovery,
    net_amount: netAmount,
    bre_calculation: {
      original_incentive: incentive,
      calculated_incentive: calculatedIncentive,
      rules_applied: ['bonus_on_high_base', 'cap_at_20_percent'],
      calculation_timestamp: new Date().toISOString(),
    },
  };
};

const processPayoutDataUpload = async (job: Job<JobData>) => {
  const { jobId, cycleId, filePath, userId } = job.data;
  const errors: any[] = [];
  let totalRecords = 0;
  let successRecords = 0;
  let failedRecords = 0;

  try {
    await query(
      'UPDATE upload_jobs SET status = ?, updated_at = NOW() WHERE job_id = ?',
      ['Processing', jobId]
    );

    const payoutData: PayoutDataRow[] = [];

    // Read CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: PayoutDataRow) => {
          payoutData.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    totalRecords = payoutData.length;

    await query(
      'UPDATE upload_jobs SET total_records = ? WHERE job_id = ?',
      [totalRecords, jobId]
    );

    // Process each payout record
    for (let i = 0; i < payoutData.length; i++) {
      const row = payoutData[i];
      const rowNumber = i + 2;

      try {
        // Validate fields
        const rowErrors: string[] = [];

        if (!row.dealer_code) rowErrors.push('Dealer code is required');
        if (!row.payout_type) rowErrors.push('Payout type is required');
        if (!row.base_amount) rowErrors.push('Base amount is required');
        if (!row.incentive_amount) rowErrors.push('Incentive amount is required');

        if (rowErrors.length > 0) {
          errors.push({ row: rowNumber, errors: rowErrors });
          failedRecords++;
          continue;
        }

        // Check if dealer exists
        const dealers = await query<any[]>(
          'SELECT id FROM dealers WHERE dealer_code = ? AND status = ?',
          [row.dealer_code, 'Approved']
        );

        if (dealers.length === 0) {
          errors.push({
            row: rowNumber,
            errors: [`Dealer ${row.dealer_code} not found or not approved`],
          });
          failedRecords++;
          continue;
        }

        const dealerId = dealers[0].id;

        // Check for duplicate
        const existing = await query<any[]>(
          'SELECT id FROM payout_cases WHERE cycle_id = ? AND dealer_id = ?',
          [cycleId, dealerId]
        );

        if (existing.length > 0) {
          errors.push({
            row: rowNumber,
            errors: [`Payout case already exists for dealer ${row.dealer_code} in this cycle`],
          });
          failedRecords++;
          continue;
        }

        // Apply BRE calculation
        const calculation = applyBRECalculation(row);

        // Generate case number
        const case_number = `CASE-${cycleId}-${Date.now()}-${uuidv4().substring(0, 8)}`;

        // Insert payout case
        await query(
          `INSERT INTO payout_cases 
            (case_number, cycle_id, dealer_id, payout_type, 
             base_amount, incentive_amount, deduction_amount, recovery_amount, net_amount,
             status, bre_calculation, raw_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PayoutGenerated', ?, ?)`,
          [
            case_number,
            cycleId,
            dealerId,
            row.payout_type,
            calculation.base_amount,
            calculation.incentive_amount,
            calculation.deduction_amount,
            calculation.recovery_amount,
            calculation.net_amount,
            JSON.stringify(calculation.bre_calculation),
            JSON.stringify(row),
          ]
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

    // Update payout cycle totals
    const totals: any = await query(
      `SELECT COUNT(*) as total_cases, SUM(net_amount) as total_amount 
       FROM payout_cases WHERE cycle_id = ?`,
      [cycleId]
    );

    await query(
      'UPDATE payout_cycles SET total_cases = ?, total_amount = ?, status = ? WHERE id = ?',
      [totals[0].total_cases, totals[0].total_amount || 0, 'Active', cycleId]
    );

    // Update job status
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
    console.error('Payout data upload error:', error);

    await query(
      'UPDATE upload_jobs SET status = ?, error_log = ?, completed_at = NOW() WHERE job_id = ?',
      ['Failed', JSON.stringify([{ error: error.message }]), jobId]
    );

    throw error;
  }
};

// Create worker
export const payoutDataUploadWorker = new Worker(
  QUEUE_NAMES.PAYOUT_DATA_UPLOAD,
  processPayoutDataUpload,
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

payoutDataUploadWorker.on('completed', (job) => {
  console.log(`Payout data upload job ${job.id} completed successfully`);
});

payoutDataUploadWorker.on('failed', (job, err) => {
  console.error(`Payout data upload job ${job?.id} failed:`, err);
});

export default payoutDataUploadWorker;
