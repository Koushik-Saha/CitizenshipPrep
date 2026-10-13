'use client';

import { SUPPORT_MESSAGE_MAX, SUPPORT_NAME_MAX } from '@oathly/core';
import { useActionState } from 'react';

import { useT } from '@/components/i18n/provider';
import { buttonClass, fieldClass, labelClass, Notice } from '@/components/ui';

import { sendSupportMessage, type ContactState } from './actions';

const initial: ContactState = {
  status: 'idle',
  problems: [],
  values: { name: '', email: '', message: '' },
};

/** The contact form. What was typed comes back with any problem, so nothing is lost. */
export function ContactForm() {
  const t = useT();
  const [state, action, pending] = useActionState(sendSupportMessage, initial);
  const wrong = (field: 'email' | 'message') => state.problems.includes(field);

  if (state.status === 'sent') {
    return (
      <Notice tone="success" role="status">
        {t('contact.sent')}
      </Notice>
    );
  }
  return (
    // Keyed by what came back, so the fields show it after a problem.
    <form action={action} key={JSON.stringify(state.values)} className="space-y-5" noValidate>
      {(state.status === 'failed' || state.status === 'wait') && (
        <Notice tone="error" role="alert">
          {t(state.status === 'wait' ? 'contact.wait' : 'contact.failed')}
        </Notice>
      )}
      <div>
        <label htmlFor="contact-name" className={labelClass}>
          {t('contact.name')}
        </label>
        <input
          id="contact-name"
          name="name"
          autoComplete="name"
          maxLength={SUPPORT_NAME_MAX}
          defaultValue={state.values.name}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="contact-email" className={labelClass}>
          {t('contact.email')}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values.email}
          aria-invalid={wrong('email') || undefined}
          aria-describedby={wrong('email') ? 'contact-email-problem' : 'contact-email-hint'}
          className={fieldClass}
        />
        {wrong('email') ? (
          <p id="contact-email-problem" role="alert" className="text-error-fg mt-1 text-sm">
            {t('contact.invalidEmail')}
          </p>
        ) : (
          <p id="contact-email-hint" className="text-fg-muted mt-1 text-sm">
            {t('contact.emailHint')}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="contact-message" className={labelClass}>
          {t('contact.message')}
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={7}
          required
          maxLength={SUPPORT_MESSAGE_MAX}
          defaultValue={state.values.message}
          dir="auto"
          aria-invalid={wrong('message') || undefined}
          aria-describedby={wrong('message') ? 'contact-message-problem' : undefined}
          className={fieldClass}
        />
        {wrong('message') && (
          <p id="contact-message-problem" role="alert" className="text-error-fg mt-1 text-sm">
            {t('contact.invalidMessage')}
          </p>
        )}
      </div>
      {/* Not for people: hidden from sight and from screen readers. A program that fills it in gives itself away. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {t('contact.send')}
      </button>
    </form>
  );
}
