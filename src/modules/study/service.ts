import { database } from '../../config/database';
import { studyRepository } from './repository';
import { parseLesson } from './parse';
import type { CreateLessonInput } from '../../contracts/study-contract';
export function studyService() {
  return createStudyService(studyRepository(database()));
}
export function createStudyService(repository: ReturnType<typeof studyRepository>) {
  return {
    ...repository,
    async create(libraryId: string, input: CreateLessonInput, ownerId: string) {
      const { parsed, itemCount, title } = parseLesson(input.tool, input.source);
      const id = await repository.create(libraryId, input, parsed, itemCount, title);
      return repository.get(libraryId, id, ownerId);
    },
  };
}
