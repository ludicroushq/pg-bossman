import { describe, expect, it } from "vitest";
import { createBossman, createQueue } from "../index";

describe("Validation", () => {
  describe("createQueue validation", () => {
    it("should throw error for empty schedule key", () => {
      expect(() => {
        createQueue()
          .input<{ test: string }>()
          .schedule({
            cron: "0 0 * * *",
            data: { test: "value" },
            key: "",
          });
      }).toThrow("schedule requires a non-empty key");
    });

    it("should throw error for invalid cron expression (too few fields)", () => {
      expect(() => {
        createQueue()
          .input<{ test: string }>()
          .schedule({
            cron: "0 0 *",
            data: { test: "value" },
            key: "test",
          });
      }).toThrow("Invalid cron expression");
    });

    it("should throw error for invalid cron expression (too many fields)", () => {
      expect(() => {
        createQueue()
          .input<{ test: string }>()
          .schedule({
            cron: "0 0 * * * * *",
            data: { test: "value" },
            key: "test",
          });
      }).toThrow("Invalid cron expression");
    });

    it("should throw error for non-string cron expression", () => {
      expect(() => {
        createQueue()
          .input<{ test: string }>()
          .schedule({
            cron: 123 as never,
            data: { test: "value" },
            key: "test",
          });
      }).toThrow("schedule requires a valid cron expression string");
    });

    it("should accept valid 5-field cron expression", () => {
      expect(() => {
        createQueue()
          .input<{ test: string }>()
          .schedule({
            cron: "0 0 * * *",
            data: { test: "value" },
            key: "test",
          })
          .handler(() => {
            // Test handler
            return {};
          });
      }).not.toThrow();
    });

    it("should accept valid 6-field cron expression", () => {
      expect(() => {
        createQueue()
          .input<{ test: string }>()
          .schedule({
            cron: "0 0 0 * * *",
            data: { test: "value" },
            key: "test",
          })
          .handler(() => {
            // Test handler
            return {};
          });
      }).not.toThrow();
    });

    it("should throw error for batchSize less than 1", () => {
      expect(() => {
        createQueue().options({ batchSize: 0 });
      }).toThrow("batchSize must be at least 1");
    });

    it("should throw error for negative batchSize", () => {
      expect(() => {
        createQueue().options({ batchSize: -5 });
      }).toThrow("batchSize must be at least 1");
    });

    it("should accept valid batchSize", () => {
      expect(() => {
        createQueue()
          .options({ batchSize: 10 })
          .batchHandler(() => []);
      }).not.toThrow();
    });

    it("should throw error for non-function handler", () => {
      expect(() => {
        createQueue().handler("not a function" as never);
      }).toThrow("handler must be a function");
    });

    it("should throw error for non-function batchHandler", () => {
      expect(() => {
        createQueue().batchHandler("not a function" as never);
      }).toThrow("batchHandler must be a function");
    });
  });

  describe("createBossman validation", () => {
    it("should throw error for null options", () => {
      expect(() => {
        createBossman(null as never);
      }).toThrow("createBossman requires options object");
    });

    it("should throw error for undefined options", () => {
      expect(() => {
        createBossman(undefined as never);
      }).toThrow("createBossman requires options object");
    });

    it("should throw error for missing connectionString and db", () => {
      expect(() => {
        createBossman({} as never);
      }).toThrow("createBossman requires either connectionString or db option");
    });

    it("should throw error for empty queue names", () => {
      expect(() => {
        createBossman({ connectionString: "test" }).register({
          "": createQueue().handler(() => {
            // Test handler
            return {};
          }),
        });
      }).toThrow("Queue names cannot be empty or whitespace-only");
    });

    it("should throw error for whitespace-only queue names", () => {
      expect(() => {
        createBossman({ connectionString: "test" }).register({
          "   ": createQueue().handler(() => {
            // Test handler
            return {};
          }),
        });
      }).toThrow("Queue names cannot be empty or whitespace-only");
    });

    it("should throw error for queue names starting with __", () => {
      expect(() => {
        createBossman({ connectionString: "test" }).register({
          __reserved: createQueue().handler(() => {
            // Test handler
            return {};
          }),
        });
      }).toThrow("cannot start with __ (reserved)");
    });

    it("should throw error for queue names with control characters", () => {
      expect(() => {
        createBossman({ connectionString: "test" }).register({
          "test\x00name": createQueue().handler(() => {
            // Test handler
            return {};
          }),
        });
      }).toThrow("contain control characters");
    });

    it("should throw error for null router", () => {
      expect(() => {
        createBossman({ connectionString: "test" }).register(null as never);
      }).toThrow("register requires a non-null object of queues");
    });

    it("should allow empty router", () => {
      expect(() => {
        createBossman({ connectionString: "test" }).register({}).build();
      }).not.toThrow();
    });

    it("should accept valid queue names", () => {
      expect(() => {
        createBossman({ connectionString: "test" })
          .register({
            valid_name: createQueue().handler(() => {
              // Test handler
              return {};
            }),
            "valid-name": createQueue().handler(() => {
              // Test handler
              return {};
            }),
            "valid.name": createQueue().handler(() => {
              // Test handler
              return {};
            }),
            validName: createQueue().handler(() => {
              // Test handler
              return {};
            }),
          })
          .build();
      }).not.toThrow();
    });

    it("should throw error when build is called without register", () => {
      expect(() => {
        createBossman({ connectionString: "test" }).build();
      }).toThrow("No queues registered");
    });
  });

  describe("Schedule key deduplication", () => {
    it("should allow multiple schedules with different keys", () => {
      const queue = createQueue()
        .input<{ test: string }>()
        .schedule({
          cron: "0 0 * * *",
          data: { test: "value1" },
          key: "schedule1",
        })
        .schedule({
          cron: "0 */6 * * *",
          data: { test: "value2" },
          key: "schedule2",
        })
        .handler(() => {
          // Test handler
          return {};
        });

      expect(queue.schedules).toHaveLength(2);
      expect(queue.schedules?.[0]?.key).toBe("schedule1");
      expect(queue.schedules?.[1]?.key).toBe("schedule2");
    });

    it("should override schedule with same key", () => {
      const queue = createQueue()
        .input<{ test: string }>()
        .schedule({
          cron: "0 0 * * *",
          data: { test: "value1" },
          key: "daily",
        })
        .schedule({
          cron: "0 12 * * *",
          data: { test: "value2" },
          key: "daily",
        })
        .handler(() => {
          // Test handler
          return {};
        });

      expect(queue.schedules).toHaveLength(1);
      expect(queue.schedules?.[0]?.key).toBe("daily");
      expect(queue.schedules?.[0]?.cron).toBe("0 12 * * *");
      expect(queue.schedules?.[0]?.data).toEqual({ test: "value2" });
    });
  });
});
