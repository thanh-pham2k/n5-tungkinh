import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  CreateLesson,
  Lesson,
  LessonSummary,
  SaveProgress,
  ApiError,
  Meta,
  Page,
  StudyTool,
  CatalogKey,
} from '../src/contracts/study-contract';
const schema = (s: z.ZodType) => z.toJSONSchema(s);
const response = (s: z.ZodType) => ({
  description: 'Success',
  content: { 'application/json': { schema: schema(s) } },
});
const one = z.object({ data: Lesson, meta: Meta });
const list = z.object({ data: z.array(LessonSummary), meta: Meta.extend({ page: Page }) });
const failure = {
  description: 'Safe API error',
  content: { 'application/json': { schema: schema(ApiError) } },
};
const errors = Object.fromEntries(
  ['400', '401', '403', '404', '409', '413', '415', '422', '503'].map((code) => [code, failure]),
);
const body = (s: z.ZodType) => ({
  required: true,
  content: { 'application/json': { schema: schema(s) } },
});
const pathId = {
  name: 'contentId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};
const document = {
  openapi: '3.1.0',
  info: { title: 'Kotoba study library', version: '1.0.0' },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/session': {
      get: {
        operationId: 'prepareStudySession',
        description:
          'Public anonymous cookie session; no learning content in cookie. SameSite Strict, HttpOnly, Secure on HTTPS.',
        responses: {
          200: response(z.object({ data: z.object({ ready: z.boolean() }), meta: Meta })),
        },
      },
    },
    '/study-contents': {
      get: {
        operationId: 'listStudyContents',
        description:
          'Public shared library, newest first; no private progress/source in list. Cursor bound to tool and library.',
        parameters: [
          { name: 'tool', in: 'query', required: true, schema: schema(StudyTool) },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          { name: 'cursor', in: 'query', schema: { type: 'string', maxLength: 500 } },
        ],
        responses: { 200: response(list), ...errors },
      },
      post: {
        operationId: 'parseAndSaveStudyContent',
        description:
          'Intentional public shared imports, valid same-origin and anonymous session required. Parse and record atomic. Maximum source 1 MB UTF-8. Request UUID idempotent forever per shared library; changed payload with same key is 409. Reimport with new UUID adds a study record, reuses matching content. Content is publicly readable.',
        requestBody: body(CreateLesson),
        responses: { 201: response(one), ...errors },
      },
    },
    '/study-contents/{contentId}': {
      get: {
        operationId: 'readStudyContent',
        description: 'Shared lesson content and progress scoped to the opaque session cookie.',
        parameters: [pathId],
        responses: { 200: response(one), ...errors },
      },
      delete: {
        operationId: 'deleteStudyContent',
        description:
          'Permanently deletes this public shared lesson and all import records and progress for every visitor in one transaction. The website requires explicit confirmation. Public destructive operation: an anonymous same-origin session cookie is required, but does not prove ownership or identity.',
        parameters: [pathId],
        responses: {
          200: response(
            z.object({ data: z.object({ id: z.uuid(), deleted: z.literal(true) }), meta: Meta }),
          ),
          ...errors,
        },
      },
    },
    '/study-contents/{contentId}/progress': {
      put: {
        operationId: 'saveStudyProgress',
        description:
          'Private to session. Same-origin. Max 256 KB. Optimistic version; stale state returns 409. No automatic overwrite or blind retry.',
        parameters: [pathId],
        requestBody: body(SaveProgress),
        responses: { 200: response(z.object({ data: SaveProgress, meta: Meta })), ...errors },
      },
    },
    '/study-catalog/{catalogId}': {
      get: {
        operationId: 'readStudyCatalogue',
        description:
          'Fixed public catalogue resources read only from Turso, never bundled or read from local files by request handlers.',
        parameters: [{ name: 'catalogId', in: 'path', required: true, schema: schema(CatalogKey) }],
        responses: { 200: response(z.object({ data: z.json(), meta: Meta })), ...errors },
      },
    },
  },
};
async function generate() {
  await mkdir('contracts', { recursive: true });
  await writeFile('contracts/openapi.yaml', JSON.stringify(document, null, 2) + '\n');
  console.log('Generated OpenAPI 3.1 contract from runtime Zod schemas.');
}
void generate();
