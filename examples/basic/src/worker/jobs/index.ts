// Export all jobs from a central location

export { cleanupOldFilesJob } from "./cleanup-old-files-job";
export { processPaymentJob } from "./process-payment-job";
export { resizeImageJob } from "./resize-image-job";
export { sendPasswordResetJob } from "./send-password-reset-job";
export { sendWelcomeEmailJob } from "./send-welcome-email-job";

import { cleanupOldFilesJob } from "./cleanup-old-files-job";
import { processPaymentJob } from "./process-payment-job";
import { resizeImageJob } from "./resize-image-job";
import { sendPasswordResetJob } from "./send-password-reset-job";
import { sendWelcomeEmailJob } from "./send-welcome-email-job";

// Flat jobs map keyed by queue names
export const jobs = {
  "emails.sendPasswordReset": sendPasswordResetJob,
  "emails.sendWelcome": sendWelcomeEmailJob,
  "maintenance.cleanupOldFiles": cleanupOldFilesJob,
  "media.resizeImage": resizeImageJob,
  "payments.processPayment": processPaymentJob,
};
