import { Hono } from "hono";
import type { Env } from "../types";
import { api } from "./api";
import { home } from "./home";
import { jobPage } from "./job";
import { queue } from "./queue";
import { queueJobsPage } from "./queue-jobs";

export const routes = new Hono<Env>()
  .route("/", home)
  .route("/api", api)
  .route("/queues", queue)
  .route("/queues", queueJobsPage)
  .route("/queues", jobPage);
