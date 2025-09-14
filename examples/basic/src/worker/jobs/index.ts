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
// Organize jobs by category for the router
import { sendWelcomeEmailJob } from "./send-welcome-email-job";

export const jobs = {
  // Email jobs
  emails: {
    sendPasswordReset: sendPasswordResetJob,
    sendWelcome: sendWelcomeEmailJob,
  },

  // Maintenance jobs
  maintenance: {
    cleanupOldFiles: cleanupOldFilesJob,
  },

  // Media processing jobs
  media: {
    resizeImage: resizeImageJob,
  },

  // Payment jobs
  payments: {
    processPayment: processPaymentJob,
  },
};
