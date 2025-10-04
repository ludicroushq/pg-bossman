import { createQueue } from "pg-bossman";

export const cleanupOldFilesJob = createQueue()
  .input<{ daysOld: number; path: string }>()
  .options({ retryLimit: 1 })
  .handler(async (input) => {
    console.log(
      `🗑️  Cleaning up files older than ${input.daysOld} days from ${input.path}`
    );

    // In production: Actually delete old files
    // const deletedFiles = await fileService.deleteOldFiles(input.path, input.daysOld);

    // Simulate cleanup work
    const CLEANUP_DELAY_MS = 2000;
    await new Promise((resolve) => setTimeout(resolve, CLEANUP_DELAY_MS));

    const MAX_FILES = 50;
    const MIN_FILES = 10;
    const SPACE_PER_FILE_MB = 1.5;
    const mockDeletedCount = Math.floor(Math.random() * MAX_FILES) + MIN_FILES;

    return {
      completedAt: new Date().toISOString(),
      deletedCount: mockDeletedCount,
      freedSpace: `${(mockDeletedCount * SPACE_PER_FILE_MB).toFixed(2)} MB`,
      path: input.path,
    };
  });
