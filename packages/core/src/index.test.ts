import { describe, expect, it } from 'vitest';

import * as core from './index';

describe('package entry', () => {
  it('exposes the engine', () => {
    for (const name of [
      'buildPracticeSet',
      'buildMockExam',
      'scoreAttempt',
      'examDecision',
      'topicMastery',
      'syncQueue',
      'parseBlueprint',
      'hello',
    ]) {
      expect(typeof (core as Record<string, unknown>)[name]).toBe('function');
    }
  });
});
