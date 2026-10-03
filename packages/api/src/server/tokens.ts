import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

// Verifies the access tokens Neon Auth issues, which the mobile app sends as
// `Authorization: Bearer`. They are JWTs signed with keys published at the
// auth service's JWKS endpoint.

export interface TokenVerifierOptions {
  /** Neon Auth's base URL (NEON_AUTH_BASE_URL). Keys are read from `${baseUrl}/jwks`. */
  baseUrl?: string;
  /** For tests: a key set to verify against instead of fetching one. */
  keys?: JWTVerifyGetKey;
}

export interface VerifiedToken {
  userId: string;
  email: string | null;
  name: string | null;
}

export function createTokenVerifier(options: TokenVerifierOptions) {
  const keys =
    options.keys ??
    createRemoteJWKSet(new URL(`${options.baseUrl!.replace(/\/$/, '')}/jwks`), {
      cooldownDuration: 60_000,
    });

  /** The token's user, or null if the token is missing, expired, or not signed by Neon Auth. */
  return async function verify(token: string | null | undefined): Promise<VerifiedToken | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, keys, { clockTolerance: 30 });
      if (typeof payload.sub !== 'string' || !payload.sub) return null;
      return {
        userId: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : null,
        name: typeof payload.name === 'string' ? payload.name : null,
      };
    } catch {
      return null;
    }
  };
}

/** The token from an `Authorization: Bearer <token>` header. */
export function bearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return match?.[1] ?? null;
}
