import "dotenv/config";
import { createBossman } from "pg-bossman";
import { jobs } from "./jobs";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost/pgboss_example";

// Create and configure the bossman instance
export const bossman = createBossman({
  connectionString: DATABASE_URL,
  // Optional: Configure pg-boss settings
  // Note: pg-boss v11 uses seconds-based config
  maintenanceIntervalSeconds: 600, // Run maintenance every 10 minutes
})
  .register(jobs)
  .build();

// Function to start the worker
export async function startWorker() {
  console.log("🚀 Starting pg-bossman worker...");

  try {
    await bossman.start();
    console.log("✅ Worker started successfully!");
    console.log("📋 Registered queues:");
    console.log("  • sendWelcomeEmail");
    console.log("  • sendPasswordResetEmail");
    console.log("  • resizeImage (batch)");
    console.log("  • cleanupOldFiles");
    console.log("  • processPayment");
    console.log("\n👂 Listening for jobs...\n");

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
      try {
        await bossman.stop({
          close: true,
          graceful: true,
          timeout: 30_000,
        });
        console.log("✅ Worker stopped successfully");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Failed to start worker:", error);
    process.exit(1);
  }
}
