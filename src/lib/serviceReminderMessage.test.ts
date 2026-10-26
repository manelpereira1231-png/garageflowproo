import { describe, it, expect } from 'vitest';
import { reminderDaysUntil, serviceReminderMessage } from './serviceReminderMessage';
describe('Reminder timing for manual communication', () => {
  for (const [date, days] of [['2026-11-09',14], ['2026-11-02',7], ['2026-10-27',1]] as const) {
    it(`uses ${days} actual days before the revision`, () => expect(reminderDaysUntil(date, '2026-10-26')).toBe(days));
  }
  it('never invents a date', () => expect(() => serviceReminderMessage({id:'r',next_service_date:null,next_service_km:120000},{clientName:'Ana',plate:'AA-00-AA',shopName:'Oficina',localDate:'2026-10-26'})).toThrow());
  it('rejects an expired revision', () => expect(() => serviceReminderMessage({id:'r',next_service_date:'2026-10-25',next_service_km:null},{clientName:'Ana',plate:'AA-00-AA',shopName:'Oficina',localDate:'2026-10-26'})).toThrow());
});