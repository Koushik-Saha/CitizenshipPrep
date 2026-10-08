// What error reports may carry, for the server and the browser alike: the
// error and where it happened, and nothing about the person. Sentry's own
// defaults collect cookies, headers, query strings and request bodies, any of
// which could hold a learner's session, address or answers, so each is
// switched off here.
export const privateByDefault = {
  // Errors only: no performance traces.
  tracesSampleRate: 0,
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
  },
} as const;
