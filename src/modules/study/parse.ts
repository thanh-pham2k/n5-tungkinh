import {
  parseInstantVocabCsv,
  parseVocabReviewCsv,
  parseWordOrderCsv,
  parseWritingReviewCsv,
} from '../../services/csv-service.js';
import { parseMultipleChoice } from '../../services/multiple-choice-service.js';
import parser from '../../services/lesson-parser.cjs';
import type { StudyToolValue } from '../../contracts/study-contract';
import { StructureTopic, SpeakingTopic } from '../../contracts/study-contract';
import { StudyError } from './errors';
export function parseLesson(
  tool: StudyToolValue,
  source: string,
): { parsed: unknown; itemCount: number; title: string } {
  try {
    let parsed: any;
    switch (tool) {
      case 'instant':
        parsed = parseInstantVocabCsv(source);
        break;
      case 'cards':
        parsed = parseVocabReviewCsv(source);
        break;
      case 'order':
      case 'typing':
        parsed = parseWordOrderCsv(source);
        break;
      case 'writing':
        parsed = parseWritingReviewCsv(source);
        break;
      case 'multiple-choice':
        parsed = parseMultipleChoice(source);
        break;
      case 'markdown': {
        parsed = parser.parse(source);
        const error = parsed.find((block: any) => block.type === 'error');
        if (error) throw new Error(error.content);
        break;
      }
      case 'structures':
      case 'speaking': {
        parsed = JSON.parse(source);
        const validated = (tool === 'structures' ? StructureTopic : SpeakingTopic).safeParse(
          parsed,
        );
        if (!validated.success)
          throw new Error('Chủ đề, câu hỏi hoặc bài luyện không đúng định dạng.');
        parsed = validated.data;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new Error('Chủ đề không hợp lệ.');
        const items = tool === 'structures' ? parsed.items : parsed.questions;
        if (typeof parsed.topic !== 'string' || !Array.isArray(items) || !items.length)
          throw new Error('Chủ đề chưa có nội dung.');
        for (const item of items) {
          if (
            tool === 'speaking'
              ? typeof item.text !== 'string' || ![1, 2, 3].includes(item.part)
              : typeof item.pattern !== 'string' || !Array.isArray(item.exercises)
          )
            throw new Error('Nội dung chủ đề không đúng định dạng.');
        }
        break;
      }
    }
    const itemCount = Array.isArray(parsed)
      ? parsed.length
      : (parsed.items || parsed.questions).length;
    if (!itemCount) throw new Error('Nội dung chưa có mục để học.');
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    const title = String(
      first.topic ||
        first.question ||
        first.vocabulary ||
        first.prompt ||
        first.content ||
        first.quizzes?.[0]?.question ||
        'Bài học',
    )
      .replace(/\s+/g, ' ')
      .slice(0, 100);
    return { parsed, itemCount, title };
  } catch (error) {
    throw new StudyError(
      422,
      'validation_error',
      error instanceof SyntaxError
        ? 'Nội dung JSON không hợp lệ.'
        : error instanceof Error
          ? error.message
          : 'Không parse được nội dung.',
    );
  }
}
