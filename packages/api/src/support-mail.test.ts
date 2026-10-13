import { describe, expect, it } from 'vitest';

import { supportEmail } from './support-mail';

const message = {
  name: 'Maria Silva',
  email: 'maria@example.test',
  message: 'I paid for Pro but my plan still says Free.\nMy receipt is from yesterday.',
};

describe('the email support receives', () => {
  it('goes to support, and a reply goes to the writer', () => {
    const mail = supportEmail('support@oathly.example', message, {
      userId: 'user-123',
      locale: 'es',
    });
    expect(mail.to).toBe('support@oathly.example');
    expect(mail.replyTo).toBe('maria@example.test');
    expect(mail.category).toBe('Support request');
    expect(mail.subject).toBe('Support: I paid for Pro but my plan still says Free.');
    expect(mail.text).toBe(
      'From: Maria Silva <maria@example.test>\nAccount: user-123\nLanguage: es\n\n' +
        'I paid for Pro but my plan still says Free.\nMy receipt is from yesterday.\n',
    );
    expect(mail.html).toContain('My receipt is from yesterday.');
  });

  it('says when the writer was not signed in, and manages without a name', () => {
    const mail = supportEmail('support@oathly.example', { ...message, name: '' });
    expect(mail.text).toContain('From: maria@example.test\nAccount: not signed in\n\n');
    expect(mail.text).not.toContain('Language:');
  });

  it('keeps a long first line out of the subject', () => {
    const mail = supportEmail('support@oathly.example', {
      ...message,
      message: `${'word '.repeat(40)}\nmore`,
    });
    expect(mail.subject.length).toBeLessThanOrEqual('Support: '.length + 68);
    expect(mail.subject.endsWith('…')).toBe(true);
  });

  it('escapes everything a stranger typed', () => {
    const mail = supportEmail('support@oathly.example', {
      name: '<b>Maria</b>',
      email: 'maria@example.test',
      message: `<script>alert("x")</script> & 'quotes'`,
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<b>');
    expect(mail.html).toContain(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quotes&#39;',
    );
    expect(mail.html).toContain('&lt;b&gt;Maria&lt;/b&gt;');
    // The plain part is the words as typed.
    expect(mail.text).toContain('<script>alert("x")</script>');
  });
});
