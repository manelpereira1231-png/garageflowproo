import { describe, it, expect } from 'vitest';
import { REMINDER_DAYS, activeReminderMilestones, hasActiveReminderNotice, parseReminderKm } from './serviceReminder';
describe('next service rules', () => {
  it('uses exactly 14, 7 and 1 day milestones', () => expect([...REMINDER_DAYS]).toEqual([14,7,1]));
  it('does not invent mileage when empty', () => expect(parseReminderKm('')).toBeNull());
  it('keeps actual mileage', () => expect(parseReminderKm('120000')).toBe(120000));
  it('rejects fractional mileage', () => expect(() => parseReminderKm('1.2')).toThrow());
  it('hides notices for replaced or expired dates', () => expect(activeReminderMilestones({ id:'r',next_service_date:'2026-10-23',next_service_km:null,reminder_days_sent:[14] },'2026-10-24')).toEqual([]));
  it('shows recorded milestones only', () => expect(activeReminderMilestones({ id:'r',next_service_date:'2026-11-07',next_service_km:null,reminder_days_sent:[14] },'2026-10-24')).toEqual([14]));
  it('uses the workshop date rather than the visitor date', () => expect(activeReminderMilestones({ id:'r', next_service_date:'2026-10-26', next_service_km:null, reminder_days_sent:[1], local_date:'2026-10-26' }, '2026-10-27')).toEqual([1]));
  it('shows a confirmed mileage notice even without a date', () => expect(hasActiveReminderNotice({id:'r',next_service_date:null,next_service_km:120000,km_notified:true},'2026-10-26')).toBe(true));
  it('does not invent a mileage notice from a target alone', () => expect(hasActiveReminderNotice({id:'r',next_service_date:null,next_service_km:120000,km_notified:false},'2026-10-26')).toBe(false));
});