import { z } from 'zod';
export const StudyTool = z.enum([
  'instant',
  'cards',
  'order',
  'typing',
  'structures',
  'speaking',
  'writing',
  'multiple-choice',
  'markdown',
]);
export const Language = z.enum(['en', 'ja']);
export const StructureTopic = z
  .object({
    topic: z.string().min(1),
    items: z
      .array(
        z
          .object({
            purpose: z.string(),
            pattern: z.string().min(1),
            example: z.string(),
            meaning: z.string(),
            exercises: z
              .array(
                z
                  .object({
                    level: z.number().int().min(1).max(5),
                    sentence: z.string().min(1),
                    meaning: z.string(),
                    chunks: z.array(z.string().min(1)).min(1),
                  })
                  .strict(),
              )
              .length(5),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export const SpeakingTopic = z
  .object({
    topic: z.string().min(1),
    date: z.string(),
    questions: z
      .array(
        z
          .object({
            id: z.string().min(1),
            part: z.union([z.literal(1), z.literal(2), z.literal(3)]),
            text: z.string().min(1),
            points: z.array(z.string()).optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export const MAX_SOURCE_BYTES = 1_000_000;
export const CreateLesson = z
  .object({
    tool: StudyTool,
    source: z.string().trim().min(1).max(MAX_SOURCE_BYTES),
    language: Language,
    requestId: z.uuid(),
  })
  .strict();
export const LessonSummary = z.object({
  id: z.uuid(),
  tool: StudyTool,
  title: z.string(),
  language: Language,
  itemCount: z.number().int().positive(),
  createdAt: z.string(),
  lastStudiedAt: z.string(),
  studyCount: z.number().int().positive(),
});
export const Lesson = LessonSummary.extend({
  source: z.string(),
  parsed: z.unknown(),
  progress: z.record(z.string(), z.unknown()),
  version: z.number().int().nonnegative(),
});
export const SaveProgress = z
  .object({ version: z.number().int().nonnegative(), progress: z.record(z.string(), z.unknown()) })
  .strict();
export const ListQuery = z
  .object({
    tool: StudyTool,
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().max(500).optional(),
  })
  .strict();
export const CatalogKey = z.enum(['ielts', 'markdown-example', 'word-order-example']);
export const Meta = z.object({ requestId: z.string() });
export const Page = z.object({
  limit: z.number(),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export const ErrorCode = z.enum([
  'invalid_request',
  'validation_error',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'invalid_cursor',
  'payload_too_large',
  'unsupported_media_type',
  'service_unavailable',
  'internal_error',
]);
export const ApiError = z.object({
  error: z.object({ code: ErrorCode, message: z.string() }),
  meta: Meta,
});
export type StudyToolValue = z.infer<typeof StudyTool>;
export type CreateLessonInput = z.infer<typeof CreateLesson>;
