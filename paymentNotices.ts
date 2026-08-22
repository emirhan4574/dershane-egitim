/**
 * Aylık ödeme günü ve otomatik hatırlatma mesajları.
 */
import type { PaymentType } from './types';

export type { PaymentType };
export type PaymentNoticeKind = 'approaching' | 'due' | 'overdue';

export type PaymentNotice = {
  id: string;
  institutionId: string;
  studentId: string;
  kind: PaymentNoticeKind;
  message: string;
  daysLate?: number;
  /** Tekrar üretmeyi engeller: 2026-08-approaching | 2026-08-due | 2026-08-overdue-7 */
  periodKey: string;
  createdAt: string;
};

export function paymentTypeLabel(t?: PaymentType | null, installmentCount?: number | null): string {
  switch (t) {
    case 'cash':
      return 'Nakit';
    case 'installment':
      return installmentCount != null && installmentCount > 0
        ? `Taksitli (${installmentCount} taksit)`
        : 'Taksitli';
    case 'credit_card':
      return 'Kredi kartı';
    default:
      return '—';
  }
}

/** Sık kullanılan taksit seçenekleri */
export const INSTALLMENT_OPTIONS = [2, 3, 4, 5, 6, 8, 9, 10, 12, 18, 24] as const;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Ayın paymentDay günü (ay kısaysa son güne iner) */
export function dueDateInMonth(year: number, monthIndex: number, paymentDay: number): Date {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, paymentDay), last);
  return startOfLocalDay(new Date(year, monthIndex, day));
}

export function paymentCycleInfo(paymentDay: number, today = new Date()) {
  const t0 = startOfLocalDay(today);
  const y = t0.getFullYear();
  const m = t0.getMonth();
  const dueThis = dueDateInMonth(y, m, paymentDay);
  const dueNext = dueDateInMonth(y, m + 1, paymentDay);

  let activeDue = dueThis;
  let daysUntil = Math.round((dueThis.getTime() - t0.getTime()) / 86400000);
  let daysOverdue = 0;

  if (daysUntil < 0) {
    daysOverdue = -daysUntil;
    daysUntil = Math.round((dueNext.getTime() - t0.getTime()) / 86400000);
    activeDue = dueThis;
  }

  const period = `${activeDue.getFullYear()}-${String(activeDue.getMonth() + 1).padStart(2, '0')}`;
  return { daysUntil, daysOverdue, period, activeDue, dueNext };
}

export function buildPaymentNoticeDraft(
  paymentDay: number,
  overdueIntervalDays: number,
  today = new Date()
): { kind: PaymentNoticeKind; message: string; daysLate?: number; periodKey: string } | null {
  if (!paymentDay || paymentDay < 1 || paymentDay > 31) return null;
  const interval = Math.max(1, overdueIntervalDays || 7);
  const { daysUntil, daysOverdue, period } = paymentCycleInfo(paymentDay, today);

  if (daysOverdue > 0) {
    const should =
      daysOverdue === 1 || (daysOverdue % interval === 0);
    if (!should) return null;
    return {
      kind: 'overdue',
      message: `Ödemeniz ${daysOverdue} gün gecikmiştir. Lütfen kurum ile iletişime geçin.`,
      daysLate: daysOverdue,
      periodKey: `${period}-overdue-${daysOverdue}`,
    };
  }

  if (daysUntil === 0) {
    return {
      kind: 'due',
      message: 'Ödeme gününüz geldi.',
      periodKey: `${period}-due`,
    };
  }

  if (daysUntil === 3) {
    return {
      kind: 'approaching',
      message: 'Ödemeniz yaklaşıyor.',
      periodKey: `${period}-approaching`,
    };
  }

  return null;
}
