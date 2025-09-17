import { Hono } from "hono";
import type { Env } from "../../types";
import { jobDetail } from "./job-detail";
import { queueDetail } from "./queue-detail";
import { queueJobs } from "./queue-jobs";
import { queues } from "./queues";

export const api = new Hono<Env>()
  .route("/queues", queues)
  .route("/queues", queueDetail)
  .route("/queues", queueJobs)
  .route("/queues", jobDetail);
