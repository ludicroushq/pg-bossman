import { createQueue } from "pg-bossman";

const FILE_EXTENSION_REGEX = /\.\w+$/;
const IMAGE_PROCESSING_DELAY_MS = 200;
const BATCH_SIZE = 10;
const RETRY_LIMIT = 3;

export const resizeImageJob = createQueue()
  .options({ batchSize: BATCH_SIZE, retryLimit: RETRY_LIMIT })
  .batchHandler(
    async (inputs: Array<{ url: string; width: number; height: number }>) => {
      console.log(`🖼️  Resizing ${inputs.length} images in batch`);

      // In production: Process images in parallel
      const results = await Promise.all(
        inputs.map(async (input) => {
          // Simulate image processing
          await new Promise((resolve) =>
            setTimeout(resolve, IMAGE_PROCESSING_DELAY_MS)
          );

          return {
            height: input.height,
            originalUrl: input.url,
            processedAt: new Date().toISOString(),
            resizedUrl: `${input.url.replace(FILE_EXTENSION_REGEX, "")}_${input.width}x${input.height}.webp`,
            width: input.width,
          };
        })
      );

      return results;
    }
  );
