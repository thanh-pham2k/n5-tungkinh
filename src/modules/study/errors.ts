import type { z } from 'zod';
import { ErrorCode } from '../../contracts/study-contract';
export class StudyError extends Error {
  constructor(
    public status: number,
    public code: z.infer<typeof ErrorCode>,
    message: string,
  ) {
    super(message);
  }
}
