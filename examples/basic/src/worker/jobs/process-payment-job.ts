import { createQueue } from "pg-bossman";

export const processPaymentJob = createQueue()
  .options({
    expireInSeconds: 300,
    retryBackoff: true,
    retryDelay: 60,
    retryLimit: 5,
  })
  .schedule("*/1 * * * *", {
    amount: 100,
    currency: "USD",
    customerId: "123",
    orderId: "123",
  })
  .handler(
    async (input: {
      orderId: string;
      amount: number;
      currency: string;
      customerId: string;
    }) => {
      console.log(
        `💳 Processing payment of ${input.amount} ${input.currency} for order ${input.orderId}`
      );

      // In production: Call payment gateway
      // const result = await paymentGateway.charge(input);

      // Simulate payment processing
      const PROCESSING_DELAY_MS = 1500;
      await new Promise((resolve) => setTimeout(resolve, PROCESSING_DELAY_MS));

      // Randomly simulate success/failure for demo
      const FAILURE_RATE = 0.9;
      const success = Math.random() > FAILURE_RATE;

      if (!success) {
        throw new Error("Payment gateway timeout - will retry");
      }

      return {
        amount: input.amount,
        currency: input.currency,
        orderId: input.orderId,
        processedAt: new Date().toISOString(),
        status: "completed",
        transactionId: `txn_${Date.now()}`,
      };
    }
  );
