import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Zod-based request validation middleware factory
// ---------------------------------------------------------------------------

export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Creates Express middleware that validates req.body, req.query, and/or
 * req.params against the provided Zod schemas.
 *
 * On success the parsed (and potentially transformed) values replace the
 * originals on the request object.
 *
 * On failure a 400 response with structured error details is returned.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ location: string; path: string; message: string }> = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) {
        req.body = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({
            location: 'body',
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) {
        (req as Record<string, unknown>).query = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({
            location: 'query',
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) {
        (req as Record<string, unknown>).params = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({
            location: 'params',
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}

/**
 * Convenience wrapper: validate only the request body.
 */
export function validateBody(schema: ZodSchema) {
  return validate({ body: schema });
}

/**
 * Convenience wrapper: validate only query parameters.
 */
export function validateQuery(schema: ZodSchema) {
  return validate({ query: schema });
}

/**
 * Convenience wrapper: validate only route params.
 */
export function validateParams(schema: ZodSchema) {
  return validate({ params: schema });
}

/**
 * Format a ZodError into a consistent API error response.
 */
export function formatZodError(error: ZodError): { error: string; details: Array<{ path: string; message: string }> } {
  return {
    error: 'Validation failed',
    details: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}
