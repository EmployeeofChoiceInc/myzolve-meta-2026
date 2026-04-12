import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  usersTable,
  circlesTable,
  circleMembersTable,
  supportRequestsTable,
  supportContributionsTable,
  repaymentsTable,
  servicePostsTable,
  activityFeedItemsTable,
  ledgerEntriesTable,
} from "./schema";

async function seed() {
  console.log("Seeding database with demo data...");

  const existingAlice = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, "demo_alice_001"))
    .limit(1)
    .then((r) => r[0]);

  if (existingAlice) {
    console.log("Demo seed data already exists, skipping.");
    return;
  }

  const [alice] = await db
    .insert(usersTable)
    .values({ clerkId: "demo_alice_001", email: "alice@example.com", displayName: "Alice Johnson", firstName: "Alice", lastName: "Johnson" })
    .returning();
  const [ben] = await db
    .insert(usersTable)
    .values({ clerkId: "demo_ben_001", email: "ben@example.com", displayName: "Ben Rivera", firstName: "Ben", lastName: "Rivera" })
    .returning();
  const [carol] = await db
    .insert(usersTable)
    .values({ clerkId: "demo_carol_001", email: "carol@example.com", displayName: "Carol Mensah", firstName: "Carol", lastName: "Mensah" })
    .returning();

  const [circle] = await db
    .insert(circlesTable)
    .values({
      name: "Johnson Family Circle",
      circleType: "family",
      description: "A warm space for our family to support each other through life's ups and downs.",
      ownerId: alice.id,
      currency: "USD",
      privacyMode: "private",
      ledgerMode: "summary",
    })
    .returning();

  await db.insert(circleMembersTable).values([
    {
      circleId: circle.id,
      userId: alice.id,
      role: "owner",
      status: "active",
      joinedAt: new Date(),
    },
    {
      circleId: circle.id,
      userId: ben.id,
      role: "member",
      status: "active",
      joinedAt: new Date(),
    },
    {
      circleId: circle.id,
      userId: carol.id,
      role: "member",
      status: "active",
      joinedAt: new Date(),
    },
  ]);

  const [request] = await db
    .insert(supportRequestsTable)
    .values({
      circleId: circle.id,
      createdByUserId: alice.id,
      title: "Help with car repair while between jobs",
      description: "My car needs a brake job and I'm between jobs right now. Could really use some help getting this fixed so I can get to interviews.",
      amountRequested: "450.00",
      amountFunded: "200.00",
      currency: "USD",
      requestType: "money",
      visibilityScope: "whole_circle",
      repaymentExpected: true,
      repaymentStyle: "flexible",
      urgencyLevel: "urgent",
      category: "Transportation",
      privacyLevel: "standard",
      status: "partially_funded",
    })
    .returning();

  const [contribution] = await db
    .insert(supportContributionsTable)
    .values({
      requestId: request.id,
      circleId: circle.id,
      contributorUserId: ben.id,
      amount: "200.00",
      currency: "USD",
      contributionType: "loan",
      note: "Happy to help! Take your time.",
      status: "confirmed",
    })
    .returning();

  await db.insert(servicePostsTable).values([
    {
      circleId: circle.id,
      createdByUserId: carol.id,
      serviceType: "offer",
      title: "Help with grocery runs",
      description: "I do grocery runs every Saturday morning. Happy to pick up for anyone in the circle.",
      category: "Errands",
      locationMode: "in_person",
      exchangePreference: "free",
      status: "open",
      visibilityScope: "whole_circle",
    },
    {
      circleId: circle.id,
      createdByUserId: ben.id,
      serviceType: "offer",
      title: "Tutoring — Math up to Algebra 2",
      description: "Former math teacher here. Happy to help kids or adults brush up on math skills.",
      category: "Education",
      locationMode: "hybrid",
      exchangePreference: "open_to_discuss",
      status: "open",
      visibilityScope: "whole_circle",
    },
  ]);

  await db.insert(activityFeedItemsTable).values([
    {
      circleId: circle.id,
      actorUserId: alice.id,
      activityType: "request_posted",
      targetEntityType: "support_request",
      targetEntityId: request.id,
      summaryText: "posted a support request: \"Help with car repair while between jobs\"",
    },
    {
      circleId: circle.id,
      actorUserId: ben.id,
      activityType: "contribution_made",
      targetEntityType: "support_request",
      targetEntityId: request.id,
      summaryText: "offered $200 support for Alice's car repair",
    },
  ]);

  await db.insert(ledgerEntriesTable).values({
    circleId: circle.id,
    giverUserId: ben.id,
    giverName: ben.displayName,
    receiverUserId: alice.id,
    receiverName: alice.displayName,
    sourceType: "contribution",
    sourceId: contribution.id,
    entryKind: "money_given",
    amount: "200.00",
    currency: "USD",
    description: "Support for car repair",
  });

  const [completedRequest] = await db
    .insert(supportRequestsTable)
    .values({
      circleId: circle.id,
      createdByUserId: carol.id,
      title: "Help with moving costs",
      description: "I needed help covering moving van rental last month. Thanks to everyone who pitched in!",
      amountRequested: "150.00",
      amountFunded: "150.00",
      currency: "USD",
      requestType: "money",
      visibilityScope: "whole_circle",
      repaymentExpected: true,
      repaymentStyle: "flexible",
      urgencyLevel: "normal",
      category: "Housing",
      privacyLevel: "standard",
      status: "fully_funded",
    })
    .returning();

  const [completedContrib] = await db
    .insert(supportContributionsTable)
    .values({
      requestId: completedRequest.id,
      circleId: circle.id,
      contributorUserId: alice.id,
      amount: "150.00",
      currency: "USD",
      contributionType: "loan",
      note: "Of course! Happy to help you settle in.",
      status: "confirmed",
    })
    .returning();

  await db.insert(ledgerEntriesTable).values({
    circleId: circle.id,
    giverUserId: alice.id,
    giverName: alice.displayName,
    receiverUserId: carol.id,
    receiverName: carol.displayName,
    sourceType: "contribution",
    sourceId: completedContrib.id,
    entryKind: "money_given",
    amount: "150.00",
    currency: "USD",
    description: "Support for moving costs",
  });

  const [repayment] = await db
    .insert(repaymentsTable)
    .values({
      requestId: completedRequest.id,
      payerUserId: carol.id,
      payeeUserId: alice.id,
      amount: "150.00",
      currency: "USD",
      note: "Thank you so much Alice! Paying back in full.",
      status: "completed",
      paymentDate: new Date(),
    })
    .returning();

  await db.insert(ledgerEntriesTable).values({
    circleId: circle.id,
    giverUserId: carol.id,
    giverName: carol.displayName,
    receiverUserId: alice.id,
    receiverName: alice.displayName,
    sourceType: "repayment",
    sourceId: repayment.id,
    entryKind: "money_repaid",
    amount: "150.00",
    currency: "USD",
    description: "Returned support for moving costs",
  });

  await db.insert(activityFeedItemsTable).values([
    {
      circleId: circle.id,
      actorUserId: carol.id,
      activityType: "request_posted",
      targetEntityType: "support_request",
      targetEntityId: completedRequest.id,
      summaryText: "posted a support request: \"Help with moving costs\"",
    },
    {
      circleId: circle.id,
      actorUserId: alice.id,
      activityType: "contribution_made",
      targetEntityType: "support_request",
      targetEntityId: completedRequest.id,
      summaryText: "offered $150 support for Carol's moving costs",
    },
    {
      circleId: circle.id,
      actorUserId: carol.id,
      activityType: "repayment_marked",
      targetEntityType: "support_request",
      targetEntityId: completedRequest.id,
      summaryText: "returned $150 support for \"Help with moving costs\"",
    },
  ]);

  console.log("Seed complete! Created:");
  console.log(`  - 3 demo users: Alice, Ben, Carol`);
  console.log(`  - 1 circle: Johnson Family Circle`);
  console.log(`  - 2 support requests (1 partially funded, 1 fully funded + repaid)`);
  console.log(`  - 2 contributions`);
  console.log(`  - 1 completed repayment`);
  console.log(`  - 2 service posts`);
  console.log(`  - Activity feed entries`);
  console.log(`  - Ledger entries`);
}

seed().catch(console.error).finally(() => process.exit());
