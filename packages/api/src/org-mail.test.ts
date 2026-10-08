import { translatorFor } from '@oathly/i18n/messages';
import { describe, expect, it } from 'vitest';

import { inviteEmail, mailBatchRequest, mailBatchResults, parseSender } from './org-mail';

const input = {
  organizationName: 'Riverside Legal Aid',
  name: 'Maria Silva',
  role: 'member' as const,
  link: 'https://oathly.example/join/abc123',
  expiresInDays: 30,
};

describe('inviteEmail', () => {
  it('says who is inviting, to what, and gives the link once', () => {
    const mail = inviteEmail(translatorFor('en'), input);
    expect(mail.subject).toBe('Riverside Legal Aid invited you to Oathly');
    expect(mail.text).toContain('Hello Maria Silva,');
    expect(mail.text).toContain('Accept the invitation: https://oathly.example/join/abc123');
    expect(mail.text).toContain('expires in 30 days');
    expect(mail.text).toContain('not affiliated with');
    expect(mail.html).toContain('<a href="https://oathly.example/join/abc123">');
    expect(mail.html).toContain('dir="ltr" lang="en"');
  });

  it('greets someone whose name is not known, and words an admin’s invitation differently', () => {
    const mail = inviteEmail(translatorFor('en'), { ...input, name: null, role: 'admin' });
    expect(mail.text).toMatch(/^Hello,\n/);
    expect(mail.text).toContain('help run their organization');
    expect(mail.text).not.toContain('paid for');
  });

  it('is written in the language asked for, right to left where that is how it reads', () => {
    const mail = inviteEmail(translatorFor('ar'), input);
    expect(mail.html).toContain('dir="rtl" lang="ar"');
    expect(mail.subject).toContain('Riverside Legal Aid');
    expect(inviteEmail(translatorFor('es'), input).text).toContain('Hola, Maria Silva:');
  });

  it('does not let a name carry markup or a second header line', () => {
    const mail = inviteEmail(translatorFor('en'), {
      ...input,
      organizationName: 'Evil <img src=x onerror=alert(1)>\r\nBcc: someone@example.com',
      name: '<script>alert("hi")</script>',
      link: 'https://oathly.example/join/a"b',
    });
    expect(mail.html).not.toContain('<img');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;');
    expect(mail.html).toContain('href="https://oathly.example/join/a&quot;b"');
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });
});

describe('parseSender', () => {
  it('reads a name and an address, or an address alone', () => {
    expect(parseSender('Oathly <invites@example.com>')).toEqual({
      email: 'invites@example.com',
      name: 'Oathly',
    });
    expect(parseSender('  "Oathly Team"  <invites@example.com> ')).toEqual({
      email: 'invites@example.com',
      name: 'Oathly Team',
    });
    expect(parseSender('<invites@example.com>')).toEqual({ email: 'invites@example.com' });
    expect(parseSender('invites@example.com')).toEqual({ email: 'invites@example.com' });
  });

  it('is null for anything that is not a sender', () => {
    for (const value of [
      '',
      '   ',
      'Oathly',
      'Oathly <invites>',
      'a@b',
      'a b@example.com',
      null,
      undefined,
    ]) {
      expect(parseSender(value), String(value)).toBeNull();
    }
  });
});

describe('mailBatchRequest', () => {
  it('names the sender once and each message with its own recipient', () => {
    const mails = [
      { to: 'a@example.test', subject: 'One', text: 'one', html: '<p>one</p>' },
      { to: 'b@example.test', subject: 'Two', text: 'two', html: '<p>two</p>' },
    ];
    expect(mailBatchRequest({ email: 'invites@example.com', name: 'Oathly' }, mails)).toEqual({
      base: {
        from: { email: 'invites@example.com', name: 'Oathly' },
        category: 'Organization invitation',
      },
      requests: [
        { to: [{ email: 'a@example.test' }], subject: 'One', text: 'one', html: '<p>one</p>' },
        { to: [{ email: 'b@example.test' }], subject: 'Two', text: 'two', html: '<p>two</p>' },
      ],
    });
  });
});

describe('mailBatchResults', () => {
  it('says which messages were accepted, one by one', () => {
    // Mailtrap's own answer to a batch with one bad address in it.
    const body = {
      success: true,
      responses: [
        { success: true, message_ids: ['5744161997'] },
        { success: false, errors: ["address is invalid in 'to' 0"] },
      ],
    };
    expect(mailBatchResults(body, 2)).toEqual([true, false]);
  });

  it('counts nothing as sent when the answer is not what was expected', () => {
    expect(mailBatchResults({ success: false, errors: ["empty field: 'requests'"] }, 2)).toEqual([
      false,
      false,
    ]);
    expect(mailBatchResults(null, 1)).toEqual([false]);
    expect(mailBatchResults({ responses: [{ success: true }] }, 2)).toEqual([true, false]);
    expect(mailBatchResults({ responses: 'ok' }, 1)).toEqual([false]);
  });
});
