import { describe, expect, expectTypeOf, it } from 'vitest';

import { Constants, type Enums, type Tables, type TablesInsert } from './index';

describe('generated database types', () => {
  it('lists every question status', () => {
    expect(Constants.public.Enums.question_status).toEqual([
      'draft',
      'in_review',
      'published',
      'retired',
      'rejected',
    ]);
  });

  it('lists the exam format types', () => {
    expect(Constants.public.Enums.exam_format_type).toEqual([
      'written',
      'oral',
      'interview',
      'language',
    ]);
  });

  it('types a question row with its verification fields', () => {
    expectTypeOf<Tables<'questions'>['source_url']>().toEqualTypeOf<string>();
    expectTypeOf<Tables<'questions'>['last_verified_at']>().toEqualTypeOf<string | null>();
    expectTypeOf<Tables<'questions'>['verified_by']>().toEqualTypeOf<string | null>();
    expectTypeOf<Tables<'questions'>['status']>().toEqualTypeOf<Enums<'question_status'>>();
  });

  it('lets an answer be recorded without naming the user', () => {
    expectTypeOf<TablesInsert<'answer_events'>>().toExtend<{
      attempt_id: string;
      question_id: string;
      question_version: number;
      correct: boolean;
      time_ms: number;
    }>();
    expectTypeOf<TablesInsert<'answer_events'>['user_id']>().toEqualTypeOf<string | undefined>();
  });
});
