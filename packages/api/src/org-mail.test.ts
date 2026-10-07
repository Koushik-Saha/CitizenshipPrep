import { translatorFor } from '@oathly/i18n/messages';
import { describe, expect, it } from 'vitest';

import { inviteEmail } from './org-mail';

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
