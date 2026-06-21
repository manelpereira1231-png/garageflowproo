import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Play, Pause, Square, Timer, Clock, DollarSign, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatMoney, formatHours, formatHourlyRate } from "@/lib/money";

interface TimerEntry {
  id: string;
  technician_name: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  status: string;
  notes: string | null;
}

interface LaborTimerProps {
  workOrderId: string;
  shopId: string;
  technicianName?: string;
  laborRate?: number;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}


export default function LaborTimer({ workOrderId, shopId, technicianName = '', laborRate = 0 }: LaborTimerProps) {
  const { t } = useLanguage();
  const [timers, setTimers] = useState<TimerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [techName, setTechName] = useState(technicianName);
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [showAddNew, setShowAddNew] = useState(false);
  const [rate, setRate] = useState(laborRate);
  const [currencySym, setCurrencySym] = useState<string>('€');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runningTimers = timers.filter(t => t.status === 'running');
  const pausedTimers = timers.filter(t => t.status === 'paused');
  const stoppedTimers = timers.filter(t => t.status === 'stopped');
  const hasActiveOrPaused = runningTimers.length > 0 || pausedTimers.length > 0;

  const fetchTimers = useCallback(async () => {
    const { data } = await supabase
      .from("work_order_times")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false });
    setTimers((data as TimerEntry[]) || []);
    setLoading(false);
  }, [workOrderId]);

  useEffect(() => { fetchTimers(); }, [fetchTimers]);

  // Fetch shop labor rate + currency symbol
  useEffect(() => {
    supabase.from("shops").select("labor_rate, currency").eq("id", shopId).maybeSingle().then(({ data }) => {
      if (data?.labor_rate && laborRate <= 0) setRate(Number(data.labor_rate));
      // Resolve currency symbol from shop
      import("@/lib/marketPrice").then(({ getCurrencySymbol }) => {
        setCurrencySym(getCurrencySymbol((data as any)?.currency));
      });
    });
    if (laborRate > 0) setRate(laborRate);
  }, [shopId, laborRate]);

  // Live tick for ALL running timers
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (runningTimers.length > 0) {
      const tick = () => {
        const now = Date.now();
        const newElapsed: Record<string, number> = {};
        runningTimers.forEach(timer => {
          const start = new Date(timer.start_time).getTime();
          newElapsed[timer.id] = timer.duration_seconds + Math.floor((now - start) / 1000);
        });
        setElapsed(newElapsed);
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      setElapsed({});
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [runningTimers.map(t => t.id).join(',')]);

  // Calculate totals
  const totalSeconds = timers.reduce((acc, timer) => {
    if (timer.status === 'stopped' || timer.status === 'paused') return acc + timer.duration_seconds;
    if (timer.status === 'running') return acc + (elapsed[timer.id] || timer.duration_seconds);
    return acc;
  }, 0);

  const totalHours = totalSeconds / 3600;
  const totalCost = rate > 0 ? totalHours * rate : 0;

  // Group by technician
  const technicianTotals = new Map<string, number>();
  timers.forEach(timer => {
    const secs = timer.status === 'running' ? (elapsed[timer.id] || timer.duration_seconds) : timer.duration_seconds;
    technicianTotals.set(timer.technician_name, (technicianTotals.get(timer.technician_name) || 0) + secs);
  });

  const startTimer = async () => {
    if (!techName.trim()) {
      toast.error(t('workshop.timer.technician'));
      return;
    }
    const { error } = await supabase.from("work_order_times").insert({
      work_order_id: workOrderId,
      shop_id: shopId,
      technician_name: techName.trim(),
      start_time: new Date().toISOString(),
      status: 'running',
      duration_seconds: 0,
    } as any);
    if (error) { toast.error(t('workshop.timer.error')); return; }
    toast.success(t('workshop.timer.started'));
    setShowAddNew(false);
    fetchTimers();
  };

  const pauseTimer = async (timer: TimerEntry) => {
    const start = new Date(timer.start_time).getTime();
    const accum = timer.duration_seconds + Math.floor((Date.now() - start) / 1000);
    const { error } = await supabase.from("work_order_times")
      .update({ status: 'paused', duration_seconds: accum, end_time: new Date().toISOString() } as any)
      .eq("id", timer.id);
    if (error) { toast.error(t('workshop.timer.error')); return; }
    fetchTimers();
  };

  const resumeTimer = async (timer: TimerEntry) => {
    const { error } = await supabase.from("work_order_times")
      .update({ status: 'running', start_time: new Date().toISOString(), end_time: null } as any)
      .eq("id", timer.id);
    if (error) { toast.error(t('workshop.timer.error')); return; }
    fetchTimers();
  };

  const stopTimer = async (timer: TimerEntry) => {
    let finalDuration = timer.duration_seconds;
    if (timer.status === 'running') {
      const start = new Date(timer.start_time).getTime();
      finalDuration += Math.floor((Date.now() - start) / 1000);
    }
    const { error } = await supabase.from("work_order_times")
      .update({ status: 'stopped', duration_seconds: finalDuration, end_time: new Date().toISOString() } as any)
      .eq("id", timer.id);
    if (error) { toast.error(t('workshop.timer.error')); return; }
    toast.success(t('workshop.timer.stoppedMsg'));
    fetchTimers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with total */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{t('workshop.timer.title')}</span>
        </div>
        <div className="flex items-center gap-3">
          {rate > 0 && totalSeconds > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="w-3 h-3" />
              <span className="font-medium">{formatMoney(totalCost)}</span>
              <span>({formatHours(totalSeconds / 3600)} × {formatHourlyRate(rate)})</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm font-mono font-bold text-primary">
              {formatDuration(totalSeconds)}
            </span>
          </div>
        </div>
      </div>

      {/* Running timers - support multiple concurrent */}
      {runningTimers.map(timer => (
        <div key={timer.id} className="bg-primary/5 border-2 border-primary rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
              <span className="text-sm font-medium">{timer.technician_name}</span>
              <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">
                {t('workshop.timer.running')}
              </Badge>
            </div>
            <span className="font-mono text-lg font-bold text-primary tabular-nums">
              {formatDuration(elapsed[timer.id] || timer.duration_seconds)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => pauseTimer(timer)}>
              <Pause className="w-4 h-4 mr-1" />
              {t('workshop.timer.pause')}
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => stopTimer(timer)}>
              <Square className="w-4 h-4 mr-1" />
              {t('workshop.timer.stop')}
            </Button>
          </div>
        </div>
      ))}

      {/* Paused timers */}
      {pausedTimers.map(timer => (
        <div key={timer.id} className="bg-warning/5 border-2 border-warning/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pause className="w-3.5 h-3.5 text-warning" />
              <span className="text-sm font-medium">{timer.technician_name}</span>
              <Badge variant="secondary" className="bg-warning/10 text-warning text-[10px]">
                {t('workshop.timer.paused')}
              </Badge>
            </div>
            <span className="font-mono text-sm font-bold text-muted-foreground">
              {formatDuration(timer.duration_seconds)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-primary" onClick={() => resumeTimer(timer)}>
              <Play className="w-4 h-4 mr-1" />
              {t('workshop.timer.resume')}
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => stopTimer(timer)}>
              <Square className="w-4 h-4 mr-1" />
              {t('workshop.timer.stop')}
            </Button>
          </div>
        </div>
      ))}

      {/* Start new timer - always available for multi-technician */}
      {(!hasActiveOrPaused || showAddNew) && (
        <div className="flex gap-2">
          <Input
            placeholder={t('workshop.timer.technician')}
            value={techName}
            onChange={e => setTechName(e.target.value)}
            className="flex-1 text-sm"
          />
          <Button size="sm" onClick={startTimer} className="shrink-0">
            <Play className="w-4 h-4 mr-1" />
            {t('workshop.timer.start')}
          </Button>
        </div>
      )}

      {/* Add another technician button */}
      {hasActiveOrPaused && !showAddNew && (
        <Button size="sm" variant="outline" className="w-full" onClick={() => { setTechName(''); setShowAddNew(true); }}>
          <Plus className="w-4 h-4 mr-1" />
          {t('workshop.timer.addTechnician')}
        </Button>
      )}

      {/* Technician summary */}
      {technicianTotals.size > 1 && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">{t('workshop.timer.byTechnician')}</span>
          {Array.from(technicianTotals.entries()).map(([name, secs]) => (
            <div key={name} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-1.5">
              <span className="text-xs font-medium">{name}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{formatDuration(secs)}</span>
                {rate > 0 && <span className="text-xs text-primary font-medium">{formatMoney((secs / 3600) * rate)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {stoppedTimers.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground font-medium">
            {t('workshop.timer.sessions')} ({stoppedTimers.length})
          </span>
          {stoppedTimers.map(timer => (
            <div key={timer.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                <span className="text-xs font-medium">{timer.technician_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {formatDuration(timer.duration_seconds)}
                </span>
                {rate > 0 && (
                  <span className="text-xs text-primary font-medium">
                    {formatMoney((timer.duration_seconds / 3600) * rate)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
