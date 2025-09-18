import { withBasePath } from "./path";

export function api(basePath: string | undefined) {
  const b = basePath ?? "";
  return {
    eventsCard(): string {
      return withBasePath(b, "/api/queues/queues-list-card?only=events");
    },
    jobDetail(queueName: string, id: string): string {
      return withBasePath(
        b,
        `/api/queues/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(id)}`
      );
    },
    queueDetail(name: string): string {
      return withBasePath(
        b,
        `/api/queues/${encodeURIComponent(name)}/detail-card`
      );
    },
    queueJobsList(name: string, limit: number, offset: number): string {
      return withBasePath(
        b,
        `/api/queues/${encodeURIComponent(name)}/jobs/list?limit=${limit}&offset=${offset}`
      );
    },
    queueJobsPreview(name: string, limit: number): string {
      return withBasePath(
        b,
        `/api/queues/${encodeURIComponent(name)}/jobs?limit=${limit}`
      );
    },
    queuesCard(): string {
      return withBasePath(b, "/api/queues/queues-list-card");
    },
  } as const;
}
