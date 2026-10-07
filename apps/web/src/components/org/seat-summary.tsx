import type { OrgSeats } from '@oathly/api/org';
import type { Translator } from '@oathly/i18n';

import { Notice } from '@/components/ui';

/** How many seats an organization has and how they are taken up, in a line or two. */
export function SeatSummary({ t, seats }: { t: Translator; seats: OrgSeats }) {
  if (seats.total === 0 && seats.used === 0) {
    return <Notice tone="neutral">{t('org.seatsNone')}</Notice>;
  }
  return (
    <div className="space-y-3">
      <p>
        <span className="font-semibold">{t('org.seats')}: </span>
        {[
          t('org.seatsUsed', { used: Math.min(seats.used, seats.total), total: seats.total }),
          seats.pending > 0 ? t('org.seatsPending', { count: seats.pending }) : null,
          t('org.seatsAvailable', { count: seats.available }),
        ]
          .filter(Boolean)
          .join(t('exam.factSeparator'))}
      </p>
      {seats.over > 0 && (
        <Notice tone="warning" role="status">
          {t('org.seatsOver', { count: seats.over })}
        </Notice>
      )}
    </div>
  );
}
