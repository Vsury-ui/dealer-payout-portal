import { Queue, Worker, QueueEvents } from 'bullmq';
import redisConnection from '@/lib/redis';

// Queue names
export const QUEUE_NAMES = {
  DEALER_BULK_UPLOAD: 'dealer-bulk-upload',
  PAYOUT_DATA_UPLOAD: 'payout-data-upload',
  PAYOUT_CALCULATION: 'payout-calculation',
  PAYMENT_FILE_UPLOAD: 'payment-file-upload',
  OEM_PAYIN_UPLOAD: 'oem-payin-upload',
};

// Create queues
export const dealerBulkUploadQueue = new Queue(QUEUE_NAMES.DEALER_BULK_UPLOAD, {
  connection: redisConnection,
});

export const payoutDataUploadQueue = new Queue(QUEUE_NAMES.PAYOUT_DATA_UPLOAD, {
  connection: redisConnection,
});

export const payoutCalculationQueue = new Queue(QUEUE_NAMES.PAYOUT_CALCULATION, {
  connection: redisConnection,
});

export const paymentFileUploadQueue = new Queue(QUEUE_NAMES.PAYMENT_FILE_UPLOAD, {
  connection: redisConnection,
});

export const oemPayinUploadQueue = new Queue(QUEUE_NAMES.OEM_PAYIN_UPLOAD, {
  connection: redisConnection,
});

// Queue events for monitoring
export const createQueueEvents = (queueName: string) => {
  return new QueueEvents(queueName, {
    connection: redisConnection,
  });
};

// Add job to queue with standard options
export const addJob = async (
  queue: Queue,
  jobName: string,
  data: any,
  options?: any
) => {
  return await queue.add(jobName, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
    ...options,
  });
};
