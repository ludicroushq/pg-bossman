#!/usr/bin/env tsx
import dotenv from "dotenv";
import { createJob, PgBossman } from "pg-bossman";

// Timing constants
const EMAIL_SEND_DELAY_MS = 1000;
const PAYMENT_PROCESS_DELAY_MS = 1500;
const CLEANUP_DELAY_MS = 500;
const NOTIFICATION_DELAY_MS = 200;
const NOTIFICATION_BATCH_COUNT = 8;

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Please set it in your .env file");
}

// 1. Define your jobs
const sendEmailJob = createJob("sendEmail")
  .options({
    retryDelay: 60,
    retryLimit: 3,
  })
  .handler(async (input: { to: string; subject: string; body: string }) => {
    console.log(`📧 Sending email to ${input.to}: ${input.subject}`);
    // Simulate email sending
    await new Promise((resolve) => setTimeout(resolve, EMAIL_SEND_DELAY_MS));
    console.log(`✅ Email sent to ${input.to}`);
  });

const processPaymentJob = createJob("processPayment")
  .options({
    retryBackoff: true,
    retryDelay: 30,
    retryLimit: 5,
  })
  .handler(
    async (input: { amount: number; currency: string; customerId: string }) => {
      console.log(
        `💳 Processing payment: ${input.currency} ${input.amount} for customer ${input.customerId}`
      );
      // Simulate payment processing
      await new Promise((resolve) =>
        setTimeout(resolve, PAYMENT_PROCESS_DELAY_MS)
      );
      console.log("✅ Payment processed successfully");
      return { transactionId: `txn_${Date.now()}` };
    }
  );

const cleanupJob = createJob("cleanup").handler(
  async (_input: { timestamp?: number }) => {
    console.log("🧹 Running cleanup...");
    await new Promise((resolve) => setTimeout(resolve, CLEANUP_DELAY_MS));
    console.log("✅ Cleanup completed");
  }
);

// Batch processing job - processes multiple items at once
const batchNotificationJob = createJob("batchNotification")
  .options({
    batchSize: 5, // Process up to 5 notifications at once
  })
  .batchHandler(
    async (
      notifications: Array<{ userId: string; message: string; type: string }>
    ) => {
      console.log(
        `📬 Processing batch of ${notifications.length} notifications`
      );

      // Process all notifications in parallel
      const results = await Promise.all(
        notifications.map(async (notification) => {
          console.log(
            `  📨 Sending ${notification.type} to user ${notification.userId}: ${notification.message}`
          );
          // Simulate notification sending
          await new Promise((resolve) =>
            setTimeout(resolve, NOTIFICATION_DELAY_MS)
          );
          return { sent: true, userId: notification.userId };
        })
      );

      console.log(
        `✅ Batch of ${notifications.length} notifications processed`
      );
      return results;
    }
  );

// 2. Register all jobs
const bossman = new PgBossman(DATABASE_URL)
  .register(sendEmailJob)
  .register(processPaymentJob)
  .register(cleanupJob)
  .register(batchNotificationJob)
  .build();

// 3. Worker mode - processes jobs
async function startWorker() {
  console.log("🚀 Starting worker...");
  await bossman.startWorker();
  console.log("👂 Worker started and listening for jobs");
  console.log("Press Ctrl+C to stop gracefully\n");
}

// 4. Client mode - sends jobs
async function startClient() {
  console.log("🚀 Starting client...");
  console.log("📡 Connecting to database...");
  await bossman.start();
  console.log("✅ Connected to pg-boss\n");

  // Send a single email
  const emailJobId = await bossman.sendEmail.send({
    body: "Thanks for signing up!",
    subject: "Welcome!",
    to: "user@example.com",
  });
  console.log(`📧 Email job created: ${emailJobId}`);

  // Process a payment
  const paymentJobId = await bossman.processPayment.send({
    amount: 99.99,
    currency: "USD",
    customerId: "cust_123",
  });
  console.log(`💳 Payment job created: ${paymentJobId}`);

  // Schedule cleanup
  const cleanupJobId = await bossman.cleanup.send({ timestamp: Date.now() });
  console.log(`🧹 Cleanup job created: ${cleanupJobId}`);

  // Send multiple notification jobs that will be processed in batches
  console.log("\n📬 Sending notification batch jobs...");
  const notificationJobs: Array<string | null> = [];
  for (let i = 1; i <= NOTIFICATION_BATCH_COUNT; i++) {
    const jobId = await bossman.batchNotification.send({
      message: `You have a new message (#${i})`,
      type: i % 2 === 0 ? "email" : "push",
      userId: `user_${i}`,
    });
    notificationJobs.push(jobId);
  }
  console.log(
    `📬 Created ${notificationJobs.length} notification jobs (will be processed in batches of 5)`
  );

  console.log("\n✅ All jobs sent! Check the worker to see them processed.");

  await bossman.stop();
}

// Main entry point
async function main() {
  const mode = process.argv[2];

  try {
    if (mode === "worker") {
      await startWorker();
    } else if (mode === "client") {
      await startClient();
    } else {
      console.log("Usage:");
      console.log("  pnpm worker  # Start the worker to process jobs");
      console.log("  pnpm client  # Send some example jobs");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
