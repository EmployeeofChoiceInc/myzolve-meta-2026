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
    req.query = result.data;
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
