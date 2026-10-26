export const REMINDER_DAYS = [14, 7, 1] as const;
export interface ServiceReminder {
  id: string;
  vehicle_id?: string;
  client_id?: string;
  work_order_id?: string | null;
  service_type?: string | null;
  next_service_date: string | null;
  next_service_km: number | null;
  reminder_days_sent?: number[];
  km_notified?: boolean;
  local_date?: string;
}
export function activeReminderMilestones(reminder: ServiceReminder, localDate: string): number[] {
  if (!reminder.next_service_date || reminder.next_service_date < (reminder.local_date || localDate)) return [];
  return (reminder.reminder_days_sent || []).filter(d => REMINDER_DAYS.some(day => day === d));
}
export function hasActiveReminderNotice(reminder: ServiceReminder, localDate: string): boolean {
  return reminder.km_notified === true || activeReminderMilestones(reminder, localDate).length > 0;
}
export function parseReminderKm(value: string): number | null {
  if (!value.trim()) return null;
  const km = Number(value);
  if (!Number.isInteger(km) || km < 0 || km > 600000) throw new Error('Quilometragem inválida (0–600 000 km).');
  return km;
}