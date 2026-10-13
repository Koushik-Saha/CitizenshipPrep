import { describe, expect, it } from 'vitest';

import {
  base32Decode,
  base32Encode,
  deriveKey,
  matchTotp,
  newTotpSecret,
  openSecret,
  otpauthUri,
  sealSecret,
  spellSecret,
  totpCode,
  totpStep,
} from './totp';

// RFC 6238's own test secret ("12345678901234567890") and its SHA-1 vectors,
// shortened from eight digits to the six an authenticator shows.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));
const at = (seconds: number) => new Date(seconds * 1000);

describe('base32', () => {
  it('encodes the way authenticator apps expect', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Encode(Buffer.from('f'))).toBe('MY');
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('decodes what it encoded, however it was typed', () => {
    expect(base32Decode('MZXW6YTBOI')!.toString()).toBe('foobar');
    expect(base32Decode('mzxw 6ytb-oi==')!.toString()).toBe('foobar');
    expect(base32Decode('MY')!.toString()).toBe('f');
  });

  it('refuses what is not base32', () => {
    expect(base32Decode('not base32!')).toBeNull();
    expect(base32Decode('')).toBeNull();
    expect(base32Decode(' = ')).toBeNull();
  });
});

describe('a new secret', () => {
  it('is 160 random bits, different each time', () => {
    const secret = newTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
    expect(newTotpSecret()).not.toBe(secret);
  });

  it('is spelled in groups of four', () => {
    expect(spellSecret('ABCDEFGHIJ')).toBe('ABCD EFGH IJ');
    expect(spellSecret('ABCDEFGH')).toBe('ABCD EFGH');
  });
});

describe('codes', () => {
  it('match the published test vectors', () => {
    expect(totpCode(RFC_SECRET, totpStep(at(59)))).toBe('287082');
    expect(totpCode(RFC_SECRET, totpStep(at(1111111109)))).toBe('081804');
    expect(totpCode(RFC_SECRET, totpStep(at(1111111111)))).toBe('050471');
    expect(totpCode(RFC_SECRET, totpStep(at(1234567890)))).toBe('005924');
    expect(totpCode(RFC_SECRET, totpStep(at(2000000000)))).toBe('279037');
    expect(totpCode(RFC_SECRET, totpStep(at(20000000000)))).toBe('353130');
  });

  it('cannot be made from a secret that is not base32', () => {
    expect(() => totpCode('!!!', 1)).toThrow('not base32');
  });

  it('change every thirty seconds', () => {
    expect(totpStep(at(0))).toBe(0);
    expect(totpStep(at(29))).toBe(0);
    expect(totpStep(at(30))).toBe(1);
  });
});

describe('checking a typed code', () => {
  const now = at(1111111111);
  const step = totpStep(now);

  it('accepts the current code, with or without a space in it', () => {
    expect(matchTotp(RFC_SECRET, '050471', now)).toBe(step);
    expect(matchTotp(RFC_SECRET, '050 471', now)).toBe(step);
  });

  it('accepts the code just before and just after, for clocks that disagree', () => {
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), now)).toBe(step - 1);
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), now)).toBe(step + 1);
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), now)).toBeNull();
    expect(matchTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 2), now)).toBeNull();
  });

  it('refuses a wrong code and anything that is not six digits', () => {
    expect(matchTotp(RFC_SECRET, '000000', now)).toBeNull();
    expect(matchTotp(RFC_SECRET, '05047', now)).toBeNull();
    expect(matchTotp(RFC_SECRET, '0504711', now)).toBeNull();
    expect(matchTotp(RFC_SECRET, 'abcdef', now)).toBeNull();
    expect(matchTotp(RFC_SECRET, '', now)).toBeNull();
  });

  it('accepts a code once', () => {
    expect(matchTotp(RFC_SECRET, '050471', now, step)).toBeNull();
    expect(matchTotp(RFC_SECRET, '050471', now, step + 1)).toBeNull();
    // An earlier code having been used does not spend this one.
    expect(matchTotp(RFC_SECRET, '050471', now, step - 1)).toBe(step);
  });
});

describe('the address for an authenticator app', () => {
  it('names the service, the account and how codes are made', () => {
    const uri = otpauthUri('ABCDEFGH', 'maria@example.test');
    expect(uri.startsWith('otpauth://totp/Oathly%3Amaria%40example.test?')).toBe(true);
    const query = new URL(uri).searchParams;
    expect(Object.fromEntries(query)).toEqual({
      secret: 'ABCDEFGH',
      issuer: 'Oathly',
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    });
    expect(otpauthUri('ABCDEFGH', 'someone', 'Oathly staging')).toContain('issuer=Oathly+staging');
  });
});

describe('keeping the secret', () => {
  const key = deriveKey('a secret the server holds', 'second-factor');

  it('makes a different key for each purpose and each secret', () => {
    expect(key).toHaveLength(32);
    expect(deriveKey('a secret the server holds', 'session').equals(key)).toBe(false);
    expect(deriveKey('another secret', 'second-factor').equals(key)).toBe(false);
    expect(deriveKey('a secret the server holds', 'second-factor').equals(key)).toBe(true);
  });

  it('seals and opens', () => {
    const sealed = sealSecret(key, RFC_SECRET);
    expect(sealed).not.toContain(RFC_SECRET);
    expect(openSecret(key, sealed)).toBe(RFC_SECRET);
    // Sealed afresh each time: the same secret never looks the same twice.
    expect(sealSecret(key, RFC_SECRET)).not.toBe(sealed);
  });

  it('does not open with another key, or once altered', () => {
    const sealed = sealSecret(key, RFC_SECRET);
    expect(openSecret(deriveKey('another secret', 'second-factor'), sealed)).toBeNull();
    const [version, iv, tag, body] = sealed.split('.');
    const flipped = body!.startsWith('A') ? `B${body!.slice(1)}` : `A${body!.slice(1)}`;
    expect(openSecret(key, [version, iv, tag, flipped].join('.'))).toBeNull();
    expect(openSecret(key, `v2.${iv}.${tag}.${body}`)).toBeNull();
    expect(openSecret(key, 'v1.only-two')).toBeNull();
    expect(openSecret(key, '')).toBeNull();
  });
});
