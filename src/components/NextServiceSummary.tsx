import type { ServiceReminder } from '@/lib/serviceReminder';

export default function NextServiceSummary({ reminder, language = 'pt' }: { reminder?: ServiceReminder; language?: string }) {
  const english = language === 'en';
  const spanish = language === 'es';
  const label = english ? 'Next service' : spanish ? 'Próxima revisión' : 'Próxima revisão';
  const empty = english ? 'Next service not scheduled yet' : spanish ? 'Próxima revisión aún no programada' : 'Próxima revisão ainda não agendada';
  return <div className="border-t border-border pt-3 mt-3 text-sm space-y-1">
    <p className="font-medium">{label}</p>
    <p className="text-muted-foreground">{reminder?.next_service_date ? reminder.next_service_date.split('-').reverse().join('/') : empty}</p>
    {reminder?.next_service_km != null && <p className="text-muted-foreground">{reminder.next_service_km.toLocaleString(language === 'pt-BR' ? 'pt-BR' : 'pt-PT')} km</p>}
  </div>;
}