import { GraphQLError } from 'graphql';

export class AuthenticationError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 },
      },
    });
  }
}

export class AuthorizationError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    });
  }
}

export class ValidationError extends GraphQLError {
  constructor(message: string, field?: string) {
    super(message, {
      extensions: {
        code: 'BAD_USER_INPUT',
        http: { status: 400 },
        field,
      },
    });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: 'NOT_FOUND',
        http: { status: 404 },
      },
    });
  }
}

export class InternalServerError extends GraphQLError {
  constructor(message: string, originalError?: Error) {
    super(message, {
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        http: { status: 500 },
        originalError: originalError?.message,
      },
    });
  }
}

export class RateLimitError extends GraphQLError {
  constructor(message: string, retryAfter?: number) {
    super(message, {
      extensions: {
        code: 'RATE_LIMIT_EXCEEDED',
        http: { status: 429 },
        retryAfter,
      },
    });
  }
}

export class ExternalServiceError extends GraphQLError {
  constructor(service: string, message: string) {
    super(`${service} error: ${message}`, {
      extensions: {
        code: 'EXTERNAL_SERVICE_ERROR',
        http: { status: 503 },
        service,
      },
    });
  }
}
