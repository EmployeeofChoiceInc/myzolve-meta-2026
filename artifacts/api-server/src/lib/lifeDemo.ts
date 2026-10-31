import {
  GenerateLifePlanResponse,
  GetLifeDemoFixturesResponse,
  ReplanLifePlanResponse,
} from "@workspace/api-zod";
import { z } from "zod";

const demoFixtures = {
  households: [
    {
      id: "rivera",
      name: "The Rivera household",
      description: "A fictional family balancing school, shift work, and nearby relatives.",
      members: [
        {
          id: "maya",
          name: "Maya",
          relationship: "Parent",
          availability: "Usually free after 5:30 PM; unavailable during weekday shifts.",
          strengths: ["Meal planning", "School communication"],
        },
        {
          id: "leo",
          name: "Leo",
          relationship: "Parent",
          availability: "Flexible mornings; works from home most afternoons.",
          strengths: ["Driving", "Calm routines"],
        },
        {
          id: "ana",
          name: "Ana",
          relationship: "Aunt",
          availability: "Lives nearby; available with a day's notice.",
          strengths: ["School pickup", "Backup childcare"],
        },
        {
          id: "jules",
          name: "Jules",
          relationship: "Family friend",
          availability: "Available for short errands on weekends.",
          strengths: ["Grocery pickup", "Pet care"],
        },
      ],
    },
    {
      id: "chen",
      name: "The Chen household",
      description: "A fictional multigenerational household coordinating care and appointments.",
      members: [
        {
          id: "lin",
          name: "Lin",
          relationship: "Adult child",
          availability: "Free early mornings; works afternoons.",
          strengths: ["Scheduling", "Translation coordination"],
        },
        {
          id: "mei",
          name: "Mei",
          relationship: "Grandparent",
          availability: "Prefers familiar routines and advance notice.",
          strengths: ["Family meals", "Neighbor connections"],
        },
        {
          id: "ravi",
          name: "Ravi",
          relationship: "Neighbor",
          availability: "Can help with practical errands on Tuesdays and Thursdays.",
          strengths: ["Errands", "Local transport"],
        },
      ],
    },
  ],
  scenarios: [
    {
      id: "school-closure",
      title: "School closes unexpectedly",
      description:
        "The school announces a two-day closure tomorrow. The children need daytime supervision, and the adults have overlapping work commitments.",
    },
    {
      id: "caregiver-unavailable",
      title: "Caregiver unexpectedly unavailable",
      description:
        "A primary caregiver is unexpectedly unavailable for three days. The household needs help keeping meals, school routines, and essential errands on track.",
    },
    {
      id: "weather-outage",
      title: "A severe storm disrupts routines",
      description:
        "A severe storm may interrupt power and local travel for a day. The household wants to check in, prepare simple meals, and confirm safe ways to get help if needed.",
    },
  ],
} as const;

export const lifeDemoFixtures = GetLifeDemoFixturesResponse.parse(demoFixtures);

export const LifePlanSchema = GenerateLifePlanResponse;
export const LifeReplanResultSchema = ReplanLifePlanResponse;

export type LifePlan = z.infer<typeof LifePlanSchema>;
export type LifeTask = LifePlan["tasks"][number];
export const LifePlanDraftSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(600),
  assumptions: z.array(z.string().max(300)).max(12),
  clarificationQuestions: z.array(z.string().max(300)).max(12),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(500),
        assignedMemberId: z.string().nullable(),
        timing: z.string().min(1).max(120),
        rationale: z.string().min(1).max(300),
        priority: z.enum(["urgent", "soon", "flexible"]),
      }),
    )
    .max(20),
});
export type LifePlanDraft = z.infer<typeof LifePlanDraftSchema>;
export type LifeHousehold = (typeof lifeDemoFixtures.households)[number];

export function getSyntheticHousehold(householdId: string): LifeHousehold | undefined {
  return lifeDemoFixtures.households.find((household) => household.id === householdId);
}

export function validateModelAssignments(
  draft: LifePlanDraft,
  household: LifeHousehold,
): void {
  const memberIds = new Set(household.members.map((member) => member.id));
  const unknownAssignments = draft.tasks
    .map((task) => task.assignedMemberId)
    .filter((memberId): memberId is string => memberId !== null && !memberIds.has(memberId));

  if (unknownAssignments.length > 0) {
    throw new Error("The generated plan assigned a task to an unknown household member.");
  }
}

export function materializePlan(
  draft: LifePlanDraft,
  input: { householdId: string; scenarioDescription: string },
  options: { id?: string; version?: number; taskPrefix?: string } = {},
): LifePlan {
  const id = options.id ?? crypto.randomUUID();
  const version = options.version ?? 1;
  const taskPrefix = options.taskPrefix ?? `plan-${version}`;

  return LifePlanSchema.parse({
    id,
    version,
    householdId: input.householdId,
    scenarioDescription: input.scenarioDescription,
    title: draft.title,
    summary: draft.summary,
    assumptions: draft.assumptions,
    clarificationQuestions: draft.clarificationQuestions,
    tasks: draft.tasks.map((task, index) => ({
      ...task,
      id: `${taskPrefix}-task-${index + 1}`,
      status: "suggested",
      reviewRequired: false,
    })),
    generatedAt: new Date().toISOString(),
  });
}
