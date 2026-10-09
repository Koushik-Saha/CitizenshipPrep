import {
  COMMENT_MAX,
  isPlausibleExamDate,
  POST_BODY_MAX,
  POST_TITLE_MAX,
  postKinds,
  reportReasons,
  type HoldReason,
  type PostKind,
} from '@oathly/core';
import * as z from 'zod/mini';

// Study groups: what the API sends and takes. One group per country; a
// learner is in the groups of the countries they study.

export interface CommunityPost {
  id: string;
  countryCode: string;
  kind: PostKind;
  title: string;
  body: string;
  /** For a story: when the writer sat the exam. */
  examDate: string | null;
  /** The writer's name as they set it, or null. */
  author: string | null;
  mine: boolean;
  upvotes: number;
  voted: boolean;
  comments: number;
  createdAt: string;
  /** Why it is hidden. Only ever non-empty for the writer's own post. */
  heldFor: HoldReason[];
  /** It asks about someone's own case: show the attorney notice with it. */
  legalNotice: boolean;
}

export interface CommunityComment {
  id: string;
  body: string;
  author: string | null;
  mine: boolean;
  createdAt: string;
  heldFor: HoldReason[];
}

export interface CommunityThread extends CommunityPost {
  thread: CommunityComment[];
}

/** What the writer is told after posting. */
export interface Posted {
  id: string;
  heldFor: HoldReason[];
  legalNotice: boolean;
}

const trimmed = (max: number, min = 1) =>
  z.pipe(z.string().check(z.trim()), z.string().check(z.minLength(min), z.maxLength(max)));

export const newPostSchema = z
  .object({
    countryCode: z.string().check(z.regex(/^[A-Z]{2}$/)),
    kind: z.enum(postKinds),
    title: trimmed(POST_TITLE_MAX, 3),
    body: trimmed(POST_BODY_MAX, 3),
    examDate: z.nullable(z.string()),
  })
  .check(
    z.refine((post) => post.kind === 'story' || post.examDate === null, {
      message: 'Only a story has an exam date.',
      path: ['examDate'],
    }),
    z.refine((post) => post.examDate === null || isPlausibleExamDate(post.examDate), {
      message: 'Give the date you sat the exam.',
      path: ['examDate'],
    }),
  );
export type NewPost = z.infer<typeof newPostSchema>;

export const newCommentSchema = z.object({ body: trimmed(COMMENT_MAX) });

export const reportSchema = z.object({
  reason: z.enum(reportReasons),
  details: z.nullable(trimmed(1000)),
});
export type NewReport = z.infer<typeof reportSchema>;

export const postSorts = ['new', 'top'] as const;
export type PostSort = (typeof postSorts)[number];
