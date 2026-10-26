import type { ServiceReminder } from './serviceReminder';

export function reminderDaysUntil(date: string | null, localDate: string): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;
  const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${localDate}T00:00:00Z`)) / 86400000;
  return Number.isFinite(days) ? days : null;
}

export function serviceReminderMessage(reminder: ServiceReminder, context: {
  clientName: string; plate: string; shopName: string; localDate: string; language?: string;
}): { subject: string; body: string } {
  const days = reminderDaysUntil(reminder.next_service_date, context.localDate);
  if (days === null || days < 0) throw new Error('A revisão não tem uma data futura válida.');
  const br = context.language === 'pt-BR';
  const vehicle = br ? 'veículo' : 'viatura';
  const date = reminder.next_service_date?.split('-').reverse().join('/');
  const timing = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `daqui a ${days} dias`;
  const subject = days === 1 ? 'Lembrete: a próxima revisão é amanhã'
    : days === 7 ? 'Falta uma semana para a próxima revisão'
    : `A próxima revisão ${br ? 'do seu veículo' : 'da sua viatura'} aproxima-se`;
  const km = reminder.next_service_km == null ? ''
    : `\n\nA quilometragem prevista para a próxima revisão é de ${reminder.next_service_km.toLocaleString(br ? 'pt-BR' : 'pt-PT')} km.`;
  const followup = days === 14 ? 'Recomendamos que se organize com antecedência.'
    : days === 1 ? `Se precisar de confirmar ou alterar a data, ${br ? 'entre em contato com' : 'contacte'} a sua oficina.`
    : `Se precisar de esclarecer alguma questão, ${br ? 'entre em contato com' : 'contacte'} a sua oficina.`;
  return { subject, body: `Olá${context.clientName ? `, ${context.clientName}` : ''}.\n\nA próxima revisão ${br ? 'do seu' : 'da sua'} ${vehicle} ${context.plate} está prevista para ${date}, ${timing}.${km}\n\n${followup}\n\n${context.shopName}` };
}