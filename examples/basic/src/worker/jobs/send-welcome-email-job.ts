import { createJob } from "../../../../src";

export const sendWelcomeEmailJob = createJob()
  .options({ retryLimit: 3 })
  .handler(async (input: { to: string; name: string }) => {
    console.log(`📧 Sending welcome email to ${input.to}`);
    // In production: await emailService.sendWelcome(input);

    // Simulate some work
    const EMAIL_SEND_DELAY_MS = 1000;
    await new Promise((resolve) => setTimeout(resolve, EMAIL_SEND_DELAY_MS));

    return { sent: true, timestamp: new Date().toISOString() };
  });
