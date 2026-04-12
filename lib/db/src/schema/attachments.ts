import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { circlesTable } from "./circles";

export const attachmentsTable = pgTable("attachments", {
  id: serial("id").primaryKey(),
  circleId: integer("circle_id")
    .notNull()
    .references(() => circlesTable.id, { onDelete: "cascade" }),
  uploadedByUserId: integer("uploaded_by_user_id")
    .notNull()
    .references(() => usersTable.id),
  targetEntityType: text("target_entity_type").notNull(),
  targetEntityId: integer("target_entity_id").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  storageKey: text("storage_key").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const insertAttachmentSchema = createInsertSchema(attachmentsTable).omit({ id: true, createdAt: true, deletedAt: true });
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Attachment = typeof attachmentsTable.$inferSelect;
