import { z } from 'zod';
import { paginationQuery } from './common.validator';

export const createTechnicianApplicationSchema = z.object({
  yearsOfExperience: z.coerce
    .number()
    .int()
    .min(0, 'Years of experience must be between 0 and 60')
    .max(60, 'Years of experience must be between 0 and 60'),
  idType: z.enum(['NID', 'PASSPORT', 'DRIVING_LICENSE']),
  idNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{5,30}$/, 'Invalid ID number'),
  phone: z
    .string()
    .transform((val) => val.replace(/[\s-]/g, ''))
    .pipe(z.string().regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number')),
  address: z
    .string()
    .trim()
    .min(5, 'Address must be between 5 and 255 characters')
    .max(255, 'Address must be between 5 and 255 characters'),
  serviceArea: z
    .string()
    .trim()
    .min(2, 'Service area must be between 2 and 100 characters')
    .max(100, 'Service area must be between 2 and 100 characters'),
  bio: z
    .string()
    .trim()
    .min(10, 'Bio must be between 10 and 1000 characters')
    .max(1000, 'Bio must be between 10 and 1000 characters'),
  skillIds: z
    .preprocess(
      (val) => {
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed;
          } catch {
            return [val];
          }
          return [val];
        }
        return val;
      },
      z
        .array(z.string().uuid('Invalid skill ID'))
        .min(1, 'At least one skill is required')
        .max(10, 'Maximum 10 skills allowed'),
    )
    .refine((arr) => new Set(arr).size === arr.length, 'Duplicate skills are not allowed'),
});

export const rejectTechnicianApplicationSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, 'Reason must be between 10 and 500 characters')
    .max(500, 'Reason must be between 10 and 500 characters'),
});

export const listTechnicianApplicationsQuerySchema = paginationQuery(10, 100).extend({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export type CreateTechnicianApplicationInput = z.infer<typeof createTechnicianApplicationSchema>;
export type RejectTechnicianApplicationInput = z.infer<typeof rejectTechnicianApplicationSchema>;
export type ListTechnicianApplicationsQueryInput = z.infer<
  typeof listTechnicianApplicationsQuerySchema
>;
