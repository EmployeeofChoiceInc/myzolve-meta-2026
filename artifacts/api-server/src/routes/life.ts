import {
  Router,
  type IRouter,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import {
  GenerateLifePlanBody,
  GetLifeDemoFixturesResponse,
  ReplanLifePlanBody,
  ReplanLifePlanResponse,
} from "@workspace/api-zod";
import {
  getSyntheticHousehold,
  lifeDemoFixtures,
  LifePlanSchema,
  materializePlan,
  type LifeTask,
} from "../lib/lifeDemo";
import {
  generateLifePlanDraft,
  MetaLifeProviderError,
  MetaLifeUnavailableError,
} from "../lib/metaLifePlanner";

const router: IRouter = Router();
const LIFE_MODEL_LIMIT = 20;
const LIFE_MODEL_WINDOW_MS = 60_000;
const lifeModelRequests = new Map<string, { startedAt: number; count: number }>();
let requestCountSinceCleanup = 0;

const limitLifeModelCalls: RequestHandler = (req, res, next): void => {
  const now = Date.now();
  const key = req.ip || "unknown";
  const current = lifeModelRequests.get(key);
  const window =
    current && now - current.startedAt < LIFE_MODEL_WINDOW_MS
      ? current
      : { startedAt: now, count: 0 };

  if (window.count >= LIFE_MODEL_LIMIT) {
    res.status(429).json({
      error: "This demo has reached its short-term planning limit. Try again in a minute.",
    });
    return;
  }

  window.count += 1;
  lifeModelRequests.set(key, window);

  requestCountSinceCleanup += 1;
  if (requestCountSinceCleanup >= 100) {
    requestCountSinceCleanup = 0;
    for (const [entryKey, entry] of lifeModelRequests) {
      if (now - entry.startedAt >= LIFE_MODEL_WINDOW_MS) {
        lifeModelRequests.delete(entryKey);
      }
    }
    if (lifeModelRequests.size > 5000) {
      const oldestKey = lifeModelRequests.keys().next().value;
      if (oldestKey) lifeModelRequests.delete(oldestKey);
    }
  }

  next();
};

function reportModelError(
  req: Request,
  res: Response,
  error: unknown,
): void {
  if (error instanceof MetaLifeUnavailableError) {
    req.log.warn("LIFE plan request rejected because Meta is not configured");
    res.status(503).json({ error: "Model planning is temporarily unavailable." });
    return;
  }

  const providerMessage =
    error instanceof MetaLifeProviderError
      ? error.message
      : "Unexpected LIFE planning error.";
  req.log.error(
    { reason: providerMessage },
    "LIFE plan generation failed",
  );
  res.status(502).json({
    error: "A safe, validated plan could not be generated. Please try again.",
  });
}

router.get("/life/demo-fixtures", (_req, res) => {
  res.json(GetLifeDemoFixturesResponse.parse(lifeDemoFixtures));
});

router.post("/life/plans", limitLifeModelCalls, async (req, res): Promise<void> => {
  const parsed = GenerateLifePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a household and enter a scenario of at least 10 characters." });
    return;
  }

  const household = getSyntheticHousehold(parsed.data.householdId);
  if (!household) {
    res.status(400).json({ error: "Choose one of the supplied synthetic households." });
    return;
  }

  try {
    const draft = await generateLifePlanDraft({
      household,
      scenarioDescription: parsed.data.scenarioDescription,
    });
    const plan = materializePlan(draft, parsed.data);
    res.json(LifePlanSchema.parse(plan));
  } catch (error) {
    reportModelError(req, res, error);
  }
});

router.post(
  "/life/plans/replan",
  limitLifeModelCalls,
  async (req, res): Promise<void> => {
  const parsed = ReplanLifePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the plan, changed circumstances, and selected suggestions." });
    return;
  }

  const input = parsed.data;
  const household = getSyntheticHousehold(input.householdId);
  const currentPlan = LifePlanSchema.safeParse(input.plan);
  if (!household || !currentPlan.success) {
    res.status(400).json({ error: "Use a valid plan from one of the synthetic households." });
    return;
  }
  if (currentPlan.data.householdId !== household.id) {
    res.status(400).json({ error: "The selected plan belongs to a different household." });
    return;
  }

  if (new Set(input.affectedTaskIds).size !== input.affectedTaskIds.length) {
    res.status(400).json({ error: "Select each suggestion only once." });
    return;
  }

  const selectedTasks: LifeTask[] = [];
  for (const taskId of input.affectedTaskIds) {
    const task = currentPlan.data.tasks.find((candidate) => candidate.id === taskId);
    if (!task || task.status !== "suggested") {
      res.status(400).json({
        error: "Only existing, unapproved suggestions can be regenerated.",
      });
      return;
    }
    selectedTasks.push(task);
  }

  try {
    const draft = await generateLifePlanDraft({
      household,
      scenarioDescription: input.scenarioDescription,
      changedCircumstances: input.changedCircumstances,
      maxTasks: 20 - (currentPlan.data.tasks.length - selectedTasks.length),
      affectedTasks: selectedTasks.map((task) => ({
        title: task.title,
        description: task.description,
        assignedMemberId: task.assignedMemberId,
        timing: task.timing,
        rationale: task.rationale,
      })),
    });
    const nextVersion = currentPlan.data.version + 1;
    const regenerated = materializePlan(
      draft,
      {
        householdId: household.id,
        scenarioDescription: input.scenarioDescription,
      },
      {
        id: currentPlan.data.id,
        version: nextVersion,
        taskPrefix: `plan-${nextVersion}`,
      },
    );

    const selectedIds = new Set(input.affectedTaskIds);
    const tasks: LifeTask[] = [];
    let inserted = false;
    for (const task of currentPlan.data.tasks) {
      if (!selectedIds.has(task.id)) {
        tasks.push(task);
        continue;
      }
      if (!inserted) {
        tasks.push(...regenerated.tasks);
        inserted = true;
      }
    }

    const plan = LifePlanSchema.parse({
      ...currentPlan.data,
      version: nextVersion,
      scenarioDescription: input.scenarioDescription,
      title: regenerated.title,
      summary: regenerated.summary,
      assumptions: regenerated.assumptions,
      clarificationQuestions: regenerated.clarificationQuestions,
      tasks,
      generatedAt: regenerated.generatedAt,
    });
    const result = ReplanLifePlanResponse.parse({
      plan,
      preservedTaskIds: currentPlan.data.tasks
        .filter((task) => !selectedIds.has(task.id))
        .map((task) => task.id),
      refreshedTaskIds: regenerated.tasks.map((task) => task.id),
    });
    res.json(result);
  } catch (error) {
    reportModelError(req, res, error);
  }
  },
);

export default router;
