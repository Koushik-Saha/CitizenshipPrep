import { describe, expect, it } from 'vitest';

import {
  looksAutomated,
  parseSupportMessage,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_NAME_MAX,
} from './support';

const good = {
  name: ' Maria Silva ',
  email: ' maria@example.test ',
  message: '  I paid for Pro but my plan still says Free.  ',
};

describe('a message to support', () => {
  it('is kept, trimmed, when it has an address to reply to and something to say', () => {
    expect(parseSupportMessage(good)).toEqual({
      ok: true,
      message: {
        name: 'Maria Silva',
        email: 'maria@example.test',
        message: 'I paid for Pro but my plan still says Free.',
      },
    });
  });

  it('does not need a name', () => {
    const parsed = parseSupportMessage({ ...good, name: undefined });
    expect(parsed.ok && parsed.message.name).toBe('');
  });

  it('says what is missing', () => {
    expect(parseSupportMessage({})).toEqual({ ok: false, problems: ['email', 'message'] });
    expect(parseSupportMessage({ ...good, email: 'maria@' })).toEqual({
      ok: false,
      problems: ['email'],
    });
    expect(parseSupportMessage({ ...good, email: 'two words@example.test' })).toEqual({
      ok: false,
      problems: ['email'],
    });
    expect(parseSupportMessage({ ...good, email: `${'a'.repeat(250)}@example.test` })).toEqual({
      ok: false,
      problems: ['email'],
    });
    expect(parseSupportMessage({ ...good, message: 'Help' })).toEqual({
      ok: false,
      problems: ['message'],
    });
    expect(parseSupportMessage({ ...good, message: 42 })).toEqual({
      ok: false,
      problems: ['message'],
    });
  });

  it('keeps line breaks out of what goes into an email’s headers', () => {
    const parsed = parseSupportMessage({
      ...good,
      name: 'Maria\r\nBcc: everyone@example.test',
      email: 'maria@example.test\nBcc: someone@example.test',
    });
    // The address is refused outright; the name is flattened to one line.
    expect(parsed).toEqual({ ok: false, problems: ['email'] });
    const named = parseSupportMessage({ ...good, name: 'Maria\r\nBcc: everyone@example.test' });
    expect(named.ok && named.message.name).toBe('Maria Bcc: everyone@example.test');
  });

  it('keeps the message’s own line breaks, and cuts what is too long', () => {
    const parsed = parseSupportMessage({
      ...good,
      name: 'n'.repeat(500),
      message: `First line.\nSecond line.\n${'x'.repeat(5000)}`,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.message.name).toHaveLength(SUPPORT_NAME_MAX);
    expect(parsed.message.message).toHaveLength(SUPPORT_MESSAGE_MAX);
    expect(parsed.message.message.startsWith('First line.\nSecond line.')).toBe(true);
  });
});

describe('a form filled in by a program', () => {
  it('is known by the field people cannot see', () => {
    expect(looksAutomated({ website: 'https://spam.example' })).toBe(true);
    expect(looksAutomated({ website: '  ' })).toBe(false);
    expect(looksAutomated({ website: undefined })).toBe(false);
    expect(looksAutomated({})).toBe(false);
  });
});
