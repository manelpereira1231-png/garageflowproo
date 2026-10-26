import { useState } from 'react';
import { Mail, MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import ClientCommsDialog from '@/components/workshop/ClientCommsDialog';
import { supabase } from '@/integrations/supabase/client';
import { useActiveShopId } from '@/hooks/useActiveShopId';
import { clientDisplayName } from '@/lib/clientDisplayName';
import { commsEmailHtml, type WorkOrderCommsContext } from '@/lib/clientComms';
import { sendEmail } from '@/lib/emailService';
import { openWhatsApp } from '@/lib/whatsapp';
import { serviceReminderMessage } from '@/lib/serviceReminderMessage';
import type { ServiceReminder } from '@/lib/serviceReminder';

export default function ServiceReminderComms({ reminderId, vehicleId }: { reminderId: string; vehicleId: string }) {
  const activeShopId = useActiveShopId();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ reminder: ServiceReminder; ctx: WorkOrderCommsContext; message: { subject: string; body: string } } | null>(null);
  const prepare = async () => {
    if (!activeShopId || busy) return;
    setBusy(true);
    try {
      const { data: reminder, error } = await supabase.from('service_reminders').select('id,client_id,vehicle_id,next_service_date,next_service_km,status').eq('id', reminderId).eq('shop_id', activeShopId).eq('vehicle_id', vehicleId).eq('status', 'pending').single();
      if (error || !reminder) throw new Error('Esta revisão já não está disponível.');
      const [client, vehicle, shop] = await Promise.all([
        supabase.from('clients').select('name,company,email,phone').eq('id', reminder.client_id).eq('shop_id', activeShopId).is('deleted_at', null).single(),
        supabase.from('vehicles').select('plate,make,model').eq('id', vehicleId).eq('client_id', reminder.client_id).eq('shop_id', activeShopId).is('deleted_at', null).single(),
        supabase.from('shops').select('name,language,timezone,country_code').eq('id', activeShopId).single(),
      ]);
      if (!client.data || !vehicle.data || !shop.data) throw new Error('Não foi possível obter os dados da revisão.');
      const timezone = shop.data.timezone || (shop.data.country_code === 'BR' ? 'America/Sao_Paulo' : 'Europe/Lisbon');
      const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const ctx: WorkOrderCommsContext = { workOrderId: '', number: vehicle.data.plate, status: 'completed', shopId: activeShopId, shopName: shop.data.name, clientName: clientDisplayName(client.data), clientEmail: client.data.email, clientPhone: client.data.phone, plate: vehicle.data.plate, vehicleMake: vehicle.data.make, vehicleModel: vehicle.data.model, lang: shop.data.language || 'pt' };
      setPreview({ reminder, ctx, message: serviceReminderMessage(reminder, { clientName: ctx.clientName || '', plate: ctx.plate || '', shopName: ctx.shopName || '', localDate, language: ctx.lang }) });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível preparar a mensagem.'); }
    finally { setBusy(false); }
  };
  const validatePreview = async () => {
    if (!preview || preview.ctx.shopId !== activeShopId) throw new Error('A oficina ativa mudou. Abra novamente a revisão.');
    const { data, error } = await supabase.from('service_reminders').select('next_service_date,next_service_km,status').eq('id', reminderId).eq('shop_id', activeShopId).eq('vehicle_id', vehicleId).single();
    if (error || data?.status !== 'pending' || data.next_service_date !== preview.reminder.next_service_date || data.next_service_km !== preview.reminder.next_service_km) throw new Error('A revisão foi alterada. Abra novamente a mensagem.');
  };
  return <>
    <div className="flex gap-1 col-span-2 sm:col-span-4">
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Email da próxima revisão" title="Email da próxima revisão" disabled={busy || !activeShopId} onClick={prepare}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}</Button>
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="WhatsApp da próxima revisão" title="WhatsApp da próxima revisão" disabled={busy || !activeShopId} onClick={prepare}><MessageSquare className="h-4 w-4" /></Button>
    </div>
    {preview && <ClientCommsDialog open onOpenChange={open => { if (!open) setPreview(null); }} ctx={preview.ctx} description={`${preview.ctx.clientName} · ${preview.ctx.plate} · Próxima revisão`} presetsOverride={[{ id: 'revision', label: 'Próxima revisão', ...preview.message }]} onEmail={async (subject, body) => {
      await validatePreview();
      await sendEmail({ to: preview.ctx.clientEmail || '', subject, html: commsEmailHtml(subject, body, preview.ctx.shopName), shop_id: preview.ctx.shopId });
    }} onWhatsApp={body => {
      if (preview.ctx.shopId !== activeShopId) return Promise.reject(new Error('A oficina ativa mudou.'));
      return openWhatsApp({ phone: preview.ctx.clientPhone, type: 'client', customMessage: body, shopName: preview.ctx.shopName });
    }} />}
  </>;
}