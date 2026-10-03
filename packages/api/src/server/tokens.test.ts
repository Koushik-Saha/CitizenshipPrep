import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

import { bearerToken, createTokenVerifier } from './tokens';

describe('createTokenVerifier', () => {
  let sign: (claims: Record<string, unknown>, expiresIn?: string) => Promise<string>;
  let verify: ReturnType<typeof createTokenVerifier>;
  let otherKeyToken: string;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const jwk = { ...(await exportJWK(publicKey)), kid: 'key-1', alg: 'EdDSA' };
    verify = createTokenVerifier({ keys: createLocalJWKSet({ keys: [jwk] }) });
    sign = (claims, expiresIn = '15m') =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'EdDSA', kid: 'key-1' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(privateKey);

    const other = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    otherKeyToken = await new SignJWT({ sub: 'intruder' })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'key-1' })
      .setExpirationTime('15m')
      .sign(other.privateKey);
  });

  it('returns the user for a valid token', async () => {
    await expect(
      verify(await sign({ sub: 'user-1', email: 'ana@example.test', name: 'Ana' })),
    ).resolves.toEqual({
      userId: 'user-1',
      email: 'ana@example.test',
      name: 'Ana',
    });
  });

  it('rejects expired, unsigned, foreign and subject-less tokens', async () => {
    await expect(verify(await sign({ sub: 'user-1' }, '-1h'))).resolves.toBeNull();
    await expect(verify(otherKeyToken)).resolves.toBeNull();
    await expect(verify(await sign({}))).resolves.toBeNull();
    await expect(verify('not-a-jwt')).resolves.toBeNull();
    await expect(verify(null)).resolves.toBeNull();
  });
});

describe('bearerToken', () => {
  it('reads the token from an Authorization header', () => {
    expect(bearerToken('Bearer abc.def')).toBe('abc.def');
    expect(bearerToken('bearer abc')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});
