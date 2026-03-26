import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Play, Pause, Square, Timer, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface TimerEntry {
  id: string;
  technician_name: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  status: string;
}

interface LaborTimerProps {
  workOrderId: string;
  shopId: string;
  technicianName?: string;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function LaborTimer({ workOrderId, shopId, technicianName = '' }: LaborTimerProps) {
  const { t } = useLanguage();
  const [timers, setTimers] = useState<TimerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [techName, setTechName] = useState(technicianName);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeTimer = timers.find(t => t.status === 'running');
  const pausedTimer = timers.find(t => t.status === 'paused');

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

  // Live tick for active timer
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (activeTimer) {
      const calcElapsed = () => {
        const start = new Date(activeTimer.start_time).getTime();
        const now = Date.now();
        return activeTimer.duration_seconds + Math.floor((now - start) / 1000);
      };
      setElapsed(calcElapsed());
      intervalRef.current = setInterval(() => setElapsed(calcElapsed()), 1000);
    } else {
      setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTimer]);

  const totalSeconds = timers.reduce((acc, t) => {
    if (t.status === 'stopped') return acc + t.duration_seconds;
    if (t.status === 'paused') return acc + t.duration_seconds;
    return acc;
  }, 0) + (activeTimer ? elapsed : 0);

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
    fetchTimers();
  };

  const pauseTimer = async () => {
    if (!activeTimer) return;
    const start = new Date(activeTimer.start_time).getTime();
    const accum = activeTimer.duration_seconds + Math.floor((Date.now() - start) / 1000);
    const { error } = await supabase.from("work_order_times")
      .update({ status: 'paused', duration_seconds: accum, end_time: new Date().toISOString() } as any)
      .eq("id", activeTimer.id);
    if (error) { toast.error(t('workshop.timer.error')); return; }
    fetchTimers();
  };

  const resumeTimer = async () => {
    if (!pausedTimer) return;
    const { error } = await supabase.from("work_order_times")
      .update({ status: 'running', start_time: new Date().toISOString(), end_time: null } as any)
      .eq("id", pausedTimer.id);
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
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-mono font-bold text-primary">
            {formatDuration(totalSeconds)}
          </span>
        </div>
      </div>

      {/* Active timer display */}
      {activeTimer && (
        <div className="bg-primary/5 border-2 border-primary rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
              <span className="text-sm font-medium">{activeTimer.technician_name}</span>
              <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">
                {t('workshop.timer.running')}
              </Badge>
            </div>
            <span className="font-mono text-lg font-bold text-primary tabular-nums">
              {formatDuration(elapsed)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={pauseTimer}>
              <Pause className="w-4 h-4 mr-1" />
              {t('workshop.timer.pause')}
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => stopTimer(activeTimer)}>
              <Square className="w-4 h-4 mr-1" />
              {t('workshop.timer.stop')}
            </Button>
          </div>
        </div>
      )}

      {/* Paused timer */}
      {pausedTimer && !activeTimer && (
        <div className="bg-warning/5 border-2 border-warning/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Pause className="w-3.5 h-3.5 text-warning" />
              <span className="text-sm font-medium">{pausedTimer.technician_name}</span>
              <Badge variant="secondary" className="bg-warning/10 text-warning text-[10px]">
                {t('workshop.timer.paused')}
              </Badge>
            </div>
            <span className="font-mono text-sm font-bold text-muted-foreground">
              {formatDuration(pausedTimer.duration_seconds)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 bg-primary" onClick={resumeTimer}>
              <Play className="w-4 h-4 mr-1" />
              {t('workshop.timer.resume')}
            </Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => stopTimer(pausedTimer)}>
              <Square className="w-4 h-4 mr-1" />
              {t('workshop.timer.stop')}
            </Button>
          </div>
        </div>
      )}

      {/* Start new timer */}
      {!activeTimer && !pausedTimer && (
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

      {/* History */}
      {timers.filter(t => t.status === 'stopped').length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground font-medium">
            {t('workshop.timer.sessions')} ({timers.filter(t => t.status === 'stopped').length})
          </span>
          {timers.filter(t => t.status === 'stopped').map(timer => (
            <div key={timer.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                <span className="text-xs font-medium">{timer.technician_name}</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {formatDuration(timer.duration_seconds)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
