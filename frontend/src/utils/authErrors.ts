interface GraphQLErrorLike {
  message?: string;
  extensions?: { code?: unknown };
}

/**
 * Whether a refreshSession failure means the session is really gone. Only
 * UNAUTHENTICATED does: the user has to log in again. Anything else — EVE SSO
 * being down (SERVICE_UNAVAILABLE), a network error — leaves the session
 * valid, and logging the user out for it would revoke a good session.
 */
export function isSessionGone(errors: GraphQLErrorLike[]): boolean {
  return errors.some((error) => error.extensions?.code === 'UNAUTHENTICATED');
}
