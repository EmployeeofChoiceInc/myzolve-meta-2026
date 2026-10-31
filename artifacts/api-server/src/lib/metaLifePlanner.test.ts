import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request as httpRequest, type Server } from "node:http";
import test from "node:test";
import express from "express";
import lifeRouter from "../routes/life";
import {
  getSyntheticHousehold,
  lifeDemoFixtures,
  materializePlan,
  type LifePlanDraft,
} from "./lifeDemo";

const household = getSyntheticHousehold("rivera");
assert.ok(household);

const ordinaryDraft: LifePlanDraft = {
  title: "Two-day school closure",
  summary: "Coordinate daytime coverage while the adults work.",
  assumptions: ["The school has confirmed both closure days."],
  clarificationQuestions: ["Which adult can confirm the school's daily schedule?"],
  tasks: [
    {
      title: "Confirm school updates",
      description: "Check the school's official updates before each morning.",
      assignedMemberId: "maya",
      timing: "This evening",
      rationale: "Maya handles school communication.",
      priority: "soon",
    },
  ],
};

function modelResponse(
  content: unknown,
  options: { status?: number; finishReason?: string | null } = {},
): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: options.finishReason ?? "stop",
          message: {
            content: typeof content === "string" ? content : JSON.stringify(content),
          },
        },
      ],
    }),
    {
      status: options.status ?? 200,
      headers: { "content-type": "application/json" },
    },
  );
}

async function withApi(
  modelFetch: typeof fetch,
  callback: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = modelFetch;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { log: { warn: () => void; error: () => void } }).log = {
      warn: () => {},
      error: () => {},
    };
    next();
  });
  app.use(lifeRouter);
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    globalThis.fetch = originalFetch;
    server.close();
    await once(server, "close");
  }
}

function postJson<T>(url: string, body: unknown): Promise<{ status: number; body: T }> {
  const parsedUrl = new URL(url);
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      parsedUrl,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          try {
            resolve({
              status: res.statusCode ?? 0,
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as T,
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}

function getJson<T>(url: string): Promise<{ status: number; body: T }> {
  const parsedUrl = new URL(url);
  return new Promise((resolve, reject) => {
    const req = httpRequest(parsedUrl, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as T,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

test("ordinary synthetic scenario returns suggestions without implying approval or completion", async () => {
  let capturedPrompt = "";
  await withApi(
    async (_url, init) => {
      const requestBody = JSON.parse(String(init?.body));
      capturedPrompt = requestBody.messages[1].content;
      return modelResponse(ordinaryDraft);
    },
    async (baseUrl) => {
      const response = await postJson<{
        householdId: string;
        tasks: Array<{ status: string; reviewRequired: boolean; assignedMemberId: string | null }>;
        generatedAt: string;
      }>(`${baseUrl}/life/plans`, {
        householdId: "rivera",
        scenarioDescription:
          "The school announces a two-day closure tomorrow while adults have overlapping work shifts.",
      });

      assert.equal(response.status, 200);
      assert.equal(response.body.householdId, "rivera");
      assert.equal(response.body.tasks[0]?.status, "suggested");
      assert.equal(response.body.tasks[0]?.reviewRequired, false);
      assert.equal(response.body.tasks[0]?.assignedMemberId, "maya");
      assert.ok(Number.isFinite(Date.parse(response.body.generatedAt)));
      assert.match(capturedPrompt, /The Rivera household/);
      assert.match(capturedPrompt, /"id":"maya"/);
      assert.doesNotMatch(capturedPrompt, /userId|email|phone|memberRecord/i);
      assert.doesNotMatch(JSON.stringify(response.body), /life-test-key/);
    },
  );
});

test("missing details and conflicting availability are surfaced as questions, not guessed assignments", async (t) => {
  const cautiousDraft: LifePlanDraft = {
    title: "Clarify who is available",
    summary: "The schedule is unclear, so confirm availability before assigning coverage.",
    assumptions: ["No caregiver availability has been confirmed."],
    clarificationQuestions: [
      "Who is available during the daytime closure?",
      "Can Ana confirm whether she can provide a day's notice?",
    ],
    tasks: [
      {
        title: "Confirm daytime coverage",
        description: "Ask each caregiver to confirm specific available hours.",
        assignedMemberId: null,
        timing: "Before arranging care",
        rationale: "The supplied schedules conflict and do not establish coverage.",
        priority: "soon",
      },
    ],
  };

  const scenarios = [
    [
      "missing details",
      "The schedule is incomplete: two adults may be working, but no hours or backup caregiver availability is confirmed.",
    ],
    [
      "conflicting availability",
      "The adults both say they are unavailable during the school closure, while the household asks for one of them to provide daytime supervision.",
    ],
  ];

  for (const [name, scenarioDescription] of scenarios) {
    await t.test(name, async () => {
      let capturedPrompt = "";
      await withApi(
        async (_url, init) => {
          const requestBody = JSON.parse(String(init?.body));
          capturedPrompt = requestBody.messages[1].content;
          return modelResponse(cautiousDraft);
        },
        async (baseUrl) => {
          const response = await postJson<{
            assumptions: string[];
            clarificationQuestions: string[];
            tasks: Array<{ assignedMemberId: string | null }>;
          }>(`${baseUrl}/life/plans`, {
            householdId: "rivera",
            scenarioDescription,
          });

          assert.equal(response.status, 200);
          assert.ok(response.body.assumptions.length > 0);
          assert.ok(response.body.clarificationQuestions.length > 0);
          assert.equal(response.body.tasks[0]?.assignedMemberId, null);
          assert.ok(capturedPrompt.includes(scenarioDescription));
        },
      );
    });
  }
});

test("only fictional household fixtures are exposed", async () => {
  await withApi(
    async () => {
      throw new Error("Fixture reads must not call the model.");
    },
    async (baseUrl) => {
      const response = await getJson<{
        households: Array<{ id: string; members: Array<{ id: string }> }>;
        scenarios: Array<{ id: string }>;
      }>(`${baseUrl}/life/demo-fixtures`);

      assert.equal(response.status, 200);
      assert.deepEqual(
        response.body.households.map((item) => item.id),
        ["rivera", "chen"],
      );
      assert.ok(response.body.households.every((item) => item.members.length > 0));
      assert.deepEqual(
        response.body.scenarios.map((item) => item.id),
        ["school-closure", "caregiver-unavailable", "weather-outage"],
      );
      assert.doesNotMatch(JSON.stringify(response.body), /email|phone|userId|medicalRecord/i);
      assert.equal(lifeDemoFixtures.households.length, 2);
    },
  );
});

test("an unconfigured model returns unavailable instead of a fabricated plan", async () => {
  let modelCalls = 0;
  await withApi(
    async () => {
      modelCalls += 1;
      return modelResponse(ordinaryDraft);
    },
    async (baseUrl) => {
      const configuredKey = process.env.MODEL_API_KEY;
      delete process.env.MODEL_API_KEY;
      try {
        const response = await postJson<{ error: string; tasks?: unknown[] }>(
          `${baseUrl}/life/plans`,
          {
            householdId: "rivera",
            scenarioDescription: "A storm may disrupt the household for two days.",
          },
        );
        assert.equal(response.status, 503);
        assert.equal(response.body.error, "Model planning is temporarily unavailable.");
        assert.equal("tasks" in response.body, false);
        assert.equal(modelCalls, 0);
      } finally {
        if (configuredKey === undefined) delete process.env.MODEL_API_KEY;
        else process.env.MODEL_API_KEY = configuredKey;
      }
    },
  );
});

test("invalid, incomplete, and out-of-household model output never becomes a plan", async (t) => {
  const invalidResponses: Array<[string, () => Response]> = [
    ["truncated output", () => modelResponse(ordinaryDraft, { finishReason: "length" })],
    ["invalid JSON", () => modelResponse("{not-json}")],
    [
      "invalid fields",
      () => modelResponse({ ...ordinaryDraft, tasks: [{ ...ordinaryDraft.tasks[0], priority: "immediate" }] }),
    ],
    [
      "unknown member",
      () => modelResponse({
        ...ordinaryDraft,
        tasks: [{ ...ordinaryDraft.tasks[0], assignedMemberId: "outside-household" }],
      }),
    ],
  ];

  for (const [name, responseForModel] of invalidResponses) {
    await t.test(name, async () => {
      await withApi(
        async () => responseForModel(),
        async (baseUrl) => {
          const response = await postJson<{ error: string; tasks?: unknown[] }>(
            `${baseUrl}/life/plans`,
            {
              householdId: "rivera",
              scenarioDescription: "The household needs a short-term school closure plan.",
            },
          );
          assert.equal(response.status, 502);
          assert.equal(response.body.error, "A safe, validated plan could not be generated. Please try again.");
          assert.equal("tasks" in response.body, false);
        },
      );
    });
  }
});

test("model timeouts and provider API errors return safe errors without plan content", async (t) => {
  const failures: Array<[string, typeof fetch]> = [
    ["timeout or network failure", async () => { throw new DOMException("timeout", "TimeoutError"); }],
    ["provider error status", async () => new Response("private provider details", { status: 503 })],
  ];

  for (const [name, modelFetch] of failures) {
    await t.test(name, async () => {
      await withApi(
        modelFetch,
        async (baseUrl) => {
          const response = await postJson<{ error: string; tasks?: unknown[] }>(
            `${baseUrl}/life/plans`,
            {
              householdId: "rivera",
              scenarioDescription: "A storm may disrupt the household for two days.",
            },
          );
          assert.equal(response.status, 502);
          assert.match(response.body.error, /safe, validated plan could not be generated/i);
          assert.equal("tasks" in response.body, false);
          assert.doesNotMatch(JSON.stringify(response.body), /private provider details|timeout/i);
        },
      );
    });
  }
});

test("re-planning preserves approved and completed tasks and rejects them as targets", async () => {
  const basePlan = materializePlan(ordinaryDraft, {
    householdId: household.id,
    scenarioDescription: "A two-day school closure overlaps with adult work shifts.",
  }, { id: "synthetic-plan", version: 1 });
  const suggested = basePlan.tasks[0]!;
  const approved = { ...suggested, id: "approved-task", status: "approved" as const };
  const completed = { ...suggested, id: "completed-task", status: "completed" as const };
  const plan = { ...basePlan, tasks: [suggested, approved, completed] };
  let modelCalls = 0;

  await withApi(
    async () => {
      modelCalls += 1;
      return modelResponse({
        ...ordinaryDraft,
        tasks: [{ ...ordinaryDraft.tasks[0], title: "Confirm backup coverage" }],
      });
    },
    async (baseUrl) => {
      const targetRejected = await postJson<{ error: string }>(
        `${baseUrl}/life/plans/replan`,
        {
          householdId: "rivera",
          scenarioDescription: plan.scenarioDescription,
          changedCircumstances: "One caregiver is now available earlier in the day.",
          plan,
          affectedTaskIds: ["approved-task"],
        },
      );
      assert.equal(targetRejected.status, 400);
      assert.match(targetRejected.body.error, /unapproved suggestions/i);
      assert.equal(modelCalls, 0);

      const result = await postJson<{
        plan: { version: number; tasks: Array<{ id: string; status: string; title: string }> };
        preservedTaskIds: string[];
        refreshedTaskIds: string[];
      }>(`${baseUrl}/life/plans/replan`, {
        householdId: "rivera",
        scenarioDescription: plan.scenarioDescription,
        changedCircumstances: "One caregiver is now available earlier in the day.",
        plan,
        affectedTaskIds: [suggested.id],
      });

      assert.equal(result.status, 200);
      assert.equal(result.body.plan.version, 2);
      assert.deepEqual(result.body.preservedTaskIds, ["approved-task", "completed-task"]);
      assert.deepEqual(result.body.refreshedTaskIds, ["plan-2-task-1"]);
      assert.deepEqual(
        result.body.plan.tasks.filter((task) => task.id !== "plan-2-task-1"),
        [approved, completed],
      );
      assert.equal(result.body.plan.tasks.find((task) => task.id === "plan-2-task-1")?.status, "suggested");
      assert.equal(modelCalls, 1);
    },
  );
});
