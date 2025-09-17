import { createClient } from "pg-bossman";
import type { bossman } from "./start";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost/pgboss_example";

// Create a lightweight client (no worker code bundled!)
export const client = createClient<typeof bossman>({
  connectionString: DATABASE_URL,
});

// Example usage functions
export async function sendWelcomeEmail(to: string, name: string) {
  const jobId = await client.queues["emails.sendWelcome"].send({ name, to });
  console.log(`📤 Queued welcome email job: ${jobId}`);
  return jobId;
}

const TOKEN_RADIX = 36;
const TOKEN_START = 2;
const TOKEN_LENGTH = 9;

export async function requestPasswordReset(email: string) {
  const token = `reset_${Date.now()}_${Math.random().toString(TOKEN_RADIX).substr(TOKEN_START, TOKEN_LENGTH)}`;
  const jobId = await client.queues["emails.sendPasswordReset"].send({
    to: email,
    token,
  });
  console.log(`📤 Queued password reset job: ${jobId}`);
  return jobId;
}

export async function resizeImages(
  images: Array<{ url: string; width: number; height: number }>
) {
  // These will be batched automatically based on the job's batchSize setting
  const jobIds = await Promise.all(
    images.map((img) => client.queues["media.resizeImage"].send(img))
  );
  console.log(`📤 Queued ${jobIds.length} image resize jobs (will be batched)`);
  return jobIds;
}

export async function scheduleCleanup(path: string, daysOld: number) {
  const jobId = await client.queues["maintenance.cleanupOldFiles"].send({
    daysOld,
    path,
  });
  console.log(`📤 Queued cleanup job: ${jobId}`);
  return jobId;
}

export async function processPayment(
  orderId: string,
  amount: number,
  currency: string,
  customerId: string
) {
  const jobId = await client.queues["payments.processPayment"].send({
    amount,
    currency,
    customerId,
    orderId,
  });
  console.log(`📤 Queued payment processing job: ${jobId}`);
  return jobId;
}
