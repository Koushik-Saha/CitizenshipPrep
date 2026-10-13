import { REPORT_DETAILS_MAX, questionReportReasons, type QuestionReportReason } from '@oathly/core';
import type { MessageKey } from '@oathly/i18n';
import { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Choice, Field, LinkButton, Message, useTheme } from '@/components/ui';
import { api } from '@/lib/auth';
import { useT } from '@/lib/i18n';

const reasonLabel: Record<QuestionReportReason, MessageKey> = {
  incorrect: 'report.incorrect',
  outdated: 'report.outdated',
  unclear: 'report.unclear',
  typo: 'report.typo',
};

type Step = 'closed' | 'open' | 'sending' | 'failed' | 'sent';

/**
 * "Report a problem": a learner says what is wrong with a question, and it
 * goes to the reviewers. Shown with every question. `locale` is the language
 * the question is being read in.
 */
export function ReportQuestion({ questionId, locale }: { questionId: string; locale: string }) {
  const t = useT();
  const theme = useTheme();
  const [step, setStep] = useState<Step>('closed');
  const [reason, setReason] = useState<QuestionReportReason | null>(null);
  const [details, setDetails] = useState('');

  if (step === 'sent') {
    return (
      <Body muted size="sm">
        {t('report.thanks')}
      </Body>
    );
  }
  if (step === 'closed') {
    return (
      <LinkButton label={t('report.open')} onPress={() => setStep('open')} testID="report-open" />
    );
  }

  async function send() {
    if (!reason) return;
    setStep('sending');
    try {
      await api.reportQuestion(questionId, { reason, details, locale });
      setStep('sent');
    } catch {
      setStep('failed');
    }
  }

  return (
    <View style={{ gap: theme.spacing[3] }}>
      <Body>{t('report.title')}</Body>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}
      >
        {questionReportReasons.map((option) => (
          <Choice
            key={option}
            label={t(reasonLabel[option])}
            selected={reason === option}
            onPress={() => setReason(option)}
            testID={`report-${option}`}
          />
        ))}
      </View>
      <Field
        label={t('report.details')}
        value={details}
        onChangeText={setDetails}
        maxLength={REPORT_DETAILS_MAX}
        multiline
        testID="report-details"
      />
      {step === 'failed' ? <Message tone="error">{t('report.failed')}</Message> : null}
      <Button
        label={t('report.send')}
        variant="secondary"
        disabled={!reason || step === 'sending'}
        onPress={() => void send()}
        testID="report-send"
      />
      <LinkButton label={t('report.cancel')} onPress={() => setStep('closed')} />
    </View>
  );
}
