import { createJob } from "../../../../src";

export const sendPasswordResetJob = createJob()
  .options({ retryDelay: 60, retryLimit: 2 })
  .handler(async (input: { to: string; token: string }) => {
    console.log(`🔑 Sending password reset to ${input.to}`);
    // In production: await emailService.sendPasswordReset(input);

    // Simulate some work
    const EMAIL_SEND_DELAY_MS = 500;
    await new Promise((resolve) => setTimeout(resolve, EMAIL_SEND_DELAY_MS));

    const EXPIRY_TIME_MS = 3_600_000; // 1 hour
    return {
      expiresAt: new Date(Date.now() + EXPIRY_TIME_MS).toISOString(),
      sent: true,
    };
  });
