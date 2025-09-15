import { bossman } from "./start";

// Schedule recurring jobs
export async function setupSchedules() {
  console.log("⏰ Setting up scheduled jobs...");

  // Daily cleanup at 3 AM
  await bossman.client["maintenance.cleanupOldFiles"].schedule(
    "daily-cleanup",
    "0 3 * * *", // Every day at 3:00 AM
    {
      daysOld: 30,
      path: "/tmp",
    },
    { tz: "America/New_York" }
  );

  // Process pending payments every 5 minutes
  // Note: In production, you'd fetch pending payments from your database
  // This is just an example of periodic job scheduling
  await bossman.client["payments.processPayment"].schedule(
    "check-pending-payments",
    "*/5 * * * *", // Every 5 minutes
    {
      amount: 0,
      currency: "USD",
      customerId: "system",
      orderId: "pending-check",
    }
  );

  console.log("✅ Scheduled jobs configured:");
  console.log("  • Daily cleanup at 3 AM");
  console.log("  • Payment check every 5 minutes");

  // List all schedules
  const schedules = await bossman.getSchedules();
  if (schedules.length > 0) {
    console.log("\n📅 Active schedules:");
    for (const schedule of schedules) {
      console.log(
        `  • ${schedule.name}: ${schedule.cron} (${schedule.timezone || "UTC"})`
      );
    }
  }
}

// Function to remove all schedules
export async function clearSchedules() {
  console.log("🧹 Clearing all scheduled jobs...");

  await bossman.client["maintenance.cleanupOldFiles"].unschedule(
    "daily-cleanup"
  );
  await bossman.client["payments.processPayment"].unschedule(
    "check-pending-payments"
  );

  console.log("✅ All schedules cleared");
}
