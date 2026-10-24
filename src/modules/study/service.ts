import { database } from '../../config/database';
import { studyRepository } from './repository';
import { parseLesson } from './parse';
import { StudyTool, type CreateLessonInput } from '../../contracts/study-contract';
export function studyService() {
  return createStudyService(studyRepository(database()));
}
export function createStudyService(repository: ReturnType<typeof studyRepository>) {
  return {
    ...repository,
    async replayLog(libraryId: string, logId: string, ownerId: string) {
      const record = await repository.getLog(libraryId, logId, ownerId);
      const parsed = parseLesson(StudyTool.parse(record.tool), record.source);
      return {
        ...record,
        title: parsed.title,
        itemCount: parsed.itemCount,
        parsed: parsed.parsed,
      };
    },
    async create(libraryId: string, input: CreateLessonInput, ownerId: string) {
      const { parsed, itemCount, title } = parseLesson(input.tool, input.source);
      const id = await repository.create(libraryId, input, parsed, itemCount, title);
      return repository.get(libraryId, id, ownerId);
    },
  };
}
