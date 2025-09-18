#!/usr/bin/env node
import "dotenv/config";
import {
  processPayment,
  requestPasswordReset,
  resizeImages,
  scheduleCleanup,
  sendWelcomeEmail,
} from "./client";
import { startWorker } from "./start";

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "worker":
      // Start the worker to process jobs
      await startWorker();
      break;

    case "client": {
      // Send some example jobs
      console.log("📨 Sending example jobs...\n");

      // Send various job types
      await sendWelcomeEmail("user@example.com", "John Doe");
      await requestPasswordReset("forgot@example.com");

      // Send multiple images for batch processing
      const IMAGE_WIDTH_SMALL = 200;
      const IMAGE_HEIGHT_SMALL = 200;
      const IMAGE_WIDTH_MEDIUM = 400;
      const IMAGE_HEIGHT_MEDIUM = 300;
      const IMAGE_WIDTH_LARGE = 800;
      const IMAGE_HEIGHT_LARGE = 600;

      await resizeImages([
        {
          height: IMAGE_HEIGHT_SMALL,
          url: "https://example.com/image1.jpg",
          width: IMAGE_WIDTH_SMALL,
        },
        {
          height: IMAGE_HEIGHT_MEDIUM,
          url: "https://example.com/image2.jpg",
          width: IMAGE_WIDTH_MEDIUM,
        },
        {
          height: IMAGE_HEIGHT_LARGE,
          url: "https://example.com/image3.jpg",
          width: IMAGE_WIDTH_LARGE,
        },
      ]);

      const CLEANUP_DAYS = 7;
      const PAYMENT_AMOUNT = 99.99;
      await scheduleCleanup("/var/tmp", CLEANUP_DAYS);
      await processPayment("order_123", PAYMENT_AMOUNT, "USD", "cust_456");

      console.log("\n✅ All example jobs queued!");
      process.exit(0);
      break;
    }

    case "schedule": {
      // Initialize and stop to ensure queues exist; schedules can be defined via queue builder
      const { bossman } = await import("./start");
      await bossman.getPgBoss();
      await bossman.stop({ close: true });
      process.exit(0);
      break;
    }

    default:
      console.log(`
pg-bossman Example

Usage:
  npm run worker    Start the worker to process jobs
  npm run client    Send example jobs to the queue
  npm run schedule  Set up scheduled jobs

Environment:
  DATABASE_URL      PostgreSQL connection string (default: postgres://localhost/pgboss_example)

Examples:
  # Terminal 1 - Start the worker
  npm run worker

  # Terminal 2 - Send jobs
  npm run client

  # With custom database
  DATABASE_URL=postgres://user:pass@host/db npm run worker
`);
      process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
