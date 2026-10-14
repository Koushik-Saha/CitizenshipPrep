import {
  queueFlags,
  queueLevels,
  queueOrigins,
  queueSorts,
  queueTypes,
  type QueueFilters,
  type QuestionQueue,
} from '@oathly/content/review';

// The filter a reviewer is working through, as the address carries it from
// the queue to a question and on to the next one. Only these names travel,
// and each value is checked against what the queue accepts, so nothing typed
// into an address ends up anywhere but a filter.

const CARRIED = ['view', 'country', 'q', 'topic', 'flag', 'origin', 'level', 'type', 'sort'];

export interface QueueContext {
  queue: QuestionQueue;
  filters: QueueFilters;
  /** The filter as a query string, to hand on: "" when nothing is filtered. */
  query: string;
}

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

const read = (params: Params, name: string): string | undefined => {
  const value = params instanceof URLSearchParams ? params.get(name) : params[name];
  return (Array.isArray(value) ? value[0] : value) || undefined;
};

export function queueContext(params: Params): QueueContext {
  const asked = read(params, 'view');
  const view = asked === 'source' || asked === 'published' ? asked : 'questions';
  const country = read(params, 'country')?.toUpperCase();
  const filters: QueueFilters = {
    countryCode: country && /^[A-Z]{2}$/.test(country) ? country : undefined,
    search: read(params, 'q')?.trim().slice(0, 100) || undefined,
    topic: read(params, 'topic'),
    flag: queueFlags.find((candidate) => candidate === read(params, 'flag')),
    origin: queueOrigins.find((candidate) => candidate === read(params, 'origin')),
    level: queueLevels.find((candidate) => candidate === read(params, 'level')),
    type: queueTypes.find((candidate) => candidate === read(params, 'type')),
    sort: queueSorts.find((candidate) => candidate === read(params, 'sort')),
  };
  const carried: Record<string, string | undefined> = {
    view: view === 'questions' ? undefined : view,
    country: filters.countryCode,
    q: filters.search,
    topic: filters.topic,
    flag: filters.flag,
    origin: filters.origin,
    level: filters.level,
    type: filters.type,
    sort: filters.sort,
  };
  const query = new URLSearchParams();
  for (const name of CARRIED) {
    const value = carried[name];
    if (value) query.set(name, value);
  }
  return {
    queue: view === 'source' ? 'source-changed' : view === 'published' ? 'published' : 'pending',
    filters,
    query: query.toString(),
  };
}

const withQuery = (path: string, query: string, extra: Record<string, string> = {}) => {
  const all = new URLSearchParams(query);
  for (const [name, value] of Object.entries(extra)) all.set(name, value);
  const text = all.toString();
  return text ? `${path}?${text}` : path;
};

/** A question's review page, keeping the filter it was reached through. */
export const questionHref = (id: string, query: string, extra?: Record<string, string>) =>
  withQuery(`/admin/content/questions/${id}`, query, extra);

/** The queue, filtered as it was. */
export const queueHref = (query: string, extra?: Record<string, string>) =>
  withQuery('/admin/content', query, extra);
