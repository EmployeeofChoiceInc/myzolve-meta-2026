import { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(422).json({
        error: "Validation failed",
        issues: result.error.issues.map((issue: z.ZodIssue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(422).json({
        error: "Validation failed",
        issues: result.error.issues.map((issue: z.ZodIssue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }
    Object.defineProperty(req, "query", {
      value: result.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    next();
  };
}

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        error: "Invalid path parameters",
        issues: result.error.issues.map((issue: z.ZodIssue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }
    req.params = result.data;
    next();
  };
}

export const circleIdParam = z.object({
  circleId: z.coerce.number().int().positive(),
});

export const requestIdParam = z.object({
  requestId: z.coerce.number().int().positive(),
});

export const serviceIdParam = z.object({
  serviceId: z.coerce.number().int().positive(),
});

export const memberIdParam = z.object({
  memberId: z.coerce.number().int().positive(),
});

export const circleAndMemberIdParam = z.object({
  circleId: z.coerce.number().int().positive(),
  memberId: z.coerce.number().int().positive(),
});

export const invitationIdParam = z.object({
  invitationId: z.coerce.number().int().positive(),
});

export const invitationTokenParam = z.object({
  token: z.string().min(1).max(200),
});

export const contributionIdParam = z.object({
  contributionId: z.coerce.number().int().positive(),
});

export const repaymentIdParam = z.object({
  repaymentId: z.coerce.number().int().positive(),
});

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const requestsListQuery = paginationQuery.extend({
  status: z.enum(["draft", "open", "accepted", "partially_funded", "fully_funded", "declined", "canceled", "completed", "archived"]).optional(),
  urgency: z.enum(["low", "normal", "important", "urgent", "emergency"]).optional(),
  category: z.string().max(100).optional(),
});

export const servicesListQuery = paginationQuery.extend({
  serviceType: z.enum(["offer", "request", "barter_offer", "barter_request"]).optional(),
  category: z.string().max(100).optional(),
  status: z.enum(["open", "matched", "completed", "canceled"]).optional(),
});

export const repaymentsListQuery = paginationQuery.extend({
  requestId: z.coerce.number().int().positive().optional(),
});
