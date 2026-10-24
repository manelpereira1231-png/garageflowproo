import { describe, it, expect } from 'vitest';
import { REMINDER_DAYS, activeReminderMilestones, parseReminderKm } from './serviceReminder';
describe('next service rules', () => {
  it('uses exactly 14, 7 and 1 day milestones', () => expect([...REMINDER_DAYS]).toEqual([14,7,1]));
  it('does not invent mileage when empty', () => expect(parseReminderKm('')).toBeNull());
  it('keeps actual mileage', () => expect(parseReminderKm('120000')).toBe(120000));
  it('rejects fractional mileage', () => expect(() => parseReminderKm('1.2')).toThrow());
  it('hides notices for replaced or expired dates', () => expect(activeReminderMilestones({ id:'r',next_service_date:'2026-10-23',next_service_km:null,reminder_days_sent:[14] },'2026-10-24')).toEqual([]));
  it('shows recorded milestones only', () => expect(activeReminderMilestones({ id:'r',next_service_date:'2026-11-07',next_service_km:null,reminder_days_sent:[14] },'2026-10-24')).toEqual([14]));
});