function dueDateInMonth(year, monthIndex, paymentDay) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, paymentDay), last);
  return new Date(year, monthIndex, day);
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function paymentCycleInfo(paymentDay, today = new Date()) {
  const t0 = startOfLocalDay(today);
  const y = t0.getFullYear();
  const m = t0.getMonth();
  const dueThis = dueDateInMonth(y, m, paymentDay);
  const dueNext = dueDateInMonth(y, m + 1, paymentDay);
  let daysUntil = Math.round((dueThis.getTime() - t0.getTime()) / 86400000);
  let daysOverdue = 0;
  let activeDue = dueThis;
  if (daysUntil < 0) {
    daysOverdue = -daysUntil;
    daysUntil = Math.round((dueNext.getTime() - t0.getTime()) / 86400000);
    activeDue = dueThis;
  }
  const period = `${activeDue.getFullYear()}-${String(activeDue.getMonth() + 1).padStart(2, '0')}`;
  return { daysUntil, daysOverdue, period };
}

function buildPaymentNoticeDraft(paymentDay, overdueIntervalDays, today = new Date()) {
  if (!paymentDay || paymentDay < 1 || paymentDay > 31) return null;
  const interval = Math.max(1, overdueIntervalDays || 7);
  const { daysUntil, daysOverdue, period } = paymentCycleInfo(paymentDay, today);
  if (daysOverdue > 0) {
    if (!(daysOverdue === 1 || daysOverdue % interval === 0)) return null;
    return {
      kind: 'overdue',
      message: `Ödemeniz ${daysOverdue} gün gecikmiştir. Lütfen kurum ile iletişime geçin.`,
      daysLate: daysOverdue,
      periodKey: `${period}-overdue-${daysOverdue}`,
    };
  }
  if (daysUntil === 0) {
    return { kind: 'due', message: 'Ödeme gününüz geldi.', periodKey: `${period}-due` };
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

module.exports = { buildPaymentNoticeDraft };
