import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayScheduleSchema = z
  .object({
    start: z.string().regex(timeRegex, 'Invalid start time format (HH:mm)'),
    end: z.string().regex(timeRegex, 'Invalid end time format (HH:mm)'),
  })
  .refine((data) => data.end > data.start, {
    message: 'End time must be later than start time',
    path: ['end'],
  })
  .nullable();

export const workingHoursSchema = z
  .object({
    monday: dayScheduleSchema.optional(),
    tuesday: dayScheduleSchema.optional(),
    wednesday: dayScheduleSchema.optional(),
    thursday: dayScheduleSchema.optional(),
    friday: dayScheduleSchema.optional(),
    saturday: dayScheduleSchema.optional(),
    sunday: dayScheduleSchema.optional(),
  })
  .strict();

export const updateTechnicianProfileSchema = z
  .object({
    bio: z
      .string()
      .trim()
      .min(10, 'Bio must be between 10 and 1000 characters')
      .max(1000, 'Bio must be between 10 and 1000 characters')
      .optional(),
    serviceArea: z
      .string()
      .trim()
      .min(2, 'Service area must be between 2 and 100 characters')
      .max(100, 'Service area must be between 2 and 100 characters')
      .optional(),
    workingHours: workingHoursSchema.optional(),
  })
  .refine(
    (data) =>
      data.bio !== undefined || data.serviceArea !== undefined || data.workingHours !== undefined,
    {
      message: 'Provide at least one field to update',
    },
  );

export const updateTechnicianSkillsSchema = z.object({
  skillIds: z
    .array(z.string().uuid('Invalid skill ID'))
    .min(1, 'At least one skill is required')
    .max(10, 'Maximum 10 skills allowed')
    .refine((arr) => new Set(arr).size === arr.length, 'Duplicate skills are not allowed'),
});

export type UpdateTechnicianProfileInput = z.infer<typeof updateTechnicianProfileSchema>;
export type UpdateTechnicianSkillsInput = z.infer<typeof updateTechnicianSkillsSchema>;
