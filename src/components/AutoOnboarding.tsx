import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Users, Car, FileText, Rocket, ArrowRight,
  MessageCircle, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Step = "client" | "vehicle" | "quote";

interface StepConfig {
  key: Step;
  label: string;
  icon: typeof Users;
  href: string;
  doneMessage: string;
  nextMessage: string;
}

const STEPS: StepConfig[] = [
  {
    key: "client",
    label: "Criar primeiro cliente",
    icon: Users,
    href: "/clients",
    doneMessage: "Cliente criado ✔",
    nextMessage: "Agora cria o primeiro veículo 👇",
  },
  {
    key: "vehicle",
    label: "Criar primeiro veículo",
    icon: Car,
    href: "/vehicles",
    doneMessage: "Veículo criado ✔",
    nextMessage: "Último passo — criar um orçamento 👇",
  },
  {
    key: "quote",
    label: "Criar primeiro orçamento",
    icon: FileText,
    href: "/quotes/new",
    doneMessage: "Orçamento criado ✔",
    nextMessage: "",
  },
];

const DISMISSED_KEY = "gf_auto_onboarding_dismissed";

export default function AutoOnboarding() {
  const { isReady, user } = useAuthReady();
  const [shopId, setShopId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Record<Step, boolean>>({
    client: false,
    vehicle: false,
    quote: false,
  });
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "1");
  const [expanded, setExpanded] = useState(true);
  const [showNudge, setShowNudge] = useState(false);
  const [botMessages, setBotMessages] = useState<string[]>([]);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reengageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve shopId directly from DB — never depend on localStorage alone
  useEffect(() => {
    if (!isReady || !user || dismissed) return;

    const resolve = async () => {
      // Try localStorage first
      const stored = localStorage.getItem("garageflow_active_shop");
      if (stored) {
        setShopId(stored);
        return;
      }

      // Fallback: query DB
      const { data } = await supabase
        .from("shops")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (data) {
        setShopId(data.id);
        localStorage.setItem("garageflow_active_shop", data.id);
      }
    };

    resolve();

    // Retry every 2s if shopId not found (shop creation may be in-flight)
    const retryInterval = setInterval(() => {
      const stored = localStorage.getItem("garageflow_active_shop");
      if (stored) {
        setShopId(stored);
        clearInterval(retryInterval);
      }
    }, 2000);

    return () => clearInterval(retryInterval);
  }, [isReady, user, dismissed]);

  // Check completion status
  const checkStatus = useCallback(async () => {
    if (!shopId) return;

    const [clientsRes, vehiclesRes, quotesRes] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("shop_id", shopId).is("deleted_at", null),
      supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("shop_id", shopId).is("deleted_at", null),
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("shop_id", shopId),
    ]);

    const newCompleted = {
      client: (clientsRes.count ?? 0) > 0,
      vehicle: (vehiclesRes.count ?? 0) > 0,
      quote: (quotesRes.count ?? 0) > 0,
    };

    // If account already has all data → old user, auto-dismiss silently
    if (newCompleted.client && newCompleted.vehicle && newCompleted.quote) {
      localStorage.setItem(DISMISSED_KEY, "1");
      setDismissed(true);
      return;
    }

    setCompleted(prev => {
      const msgs: string[] = [];
      if (!prev.client && newCompleted.client) msgs.push("✅ Cliente criado com sucesso! Agora cria o primeiro veículo.");
      if (!prev.vehicle && newCompleted.vehicle) msgs.push("✅ Veículo criado! Último passo — cria um orçamento.");
      if (!prev.quote && newCompleted.quote) msgs.push("🎉 Tudo pronto! O GarageFlow está configurado. Bom trabalho!");
      if (msgs.length > 0) {
        setBotMessages(prev => [...prev, ...msgs]);
      }
      return newCompleted;
    });

    // Bot is confirmed needed — show it
    setVisible(true);
  }, [shopId]);

  // Initial check + polling every 5s
  useEffect(() => {
    if (!shopId || dismissed) return;

    checkStatus();
    pollRef.current = setInterval(checkStatus, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkStatus, shopId, dismissed]);

  // FALLBACK: If after 3s we have a user but no shopId resolved yet, force-show anyway
  useEffect(() => {
    if (dismissed || visible) return;
    if (!isReady || !user) return;

    fallbackRef.current = setTimeout(() => {
      if (!visible) {
        setVisible(true);
      }
    }, 3000);

    return () => {
      if (fallbackRef.current) clearTimeout(fallbackRef.current);
    };
  }, [isReady, user, dismissed, visible]);

  // Initial bot message — fires when visible
  useEffect(() => {
    if (!visible || dismissed) return;

    const timer = setTimeout(() => {
      setBotMessages(prev => {
        if (prev.length === 0) {
          return ["Olá 👋 Sou o assistente automático do GarageFlow. Vou guiar-te em 3 passos simples para configurares tudo!"];
        }
        return prev;
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [visible, dismissed]);

  // Nudge timer (10s of inactivity)
  useEffect(() => {
    if (allDone || dismissed || !visible) return;

    nudgeTimerRef.current = setTimeout(() => {
      setShowNudge(true);
    }, 10000);

    return () => {
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    };
  }, [completed, dismissed, visible]);

  // Re-engagement (30s)
  useEffect(() => {
    if (allDone || dismissed || !visible) return;

    reengageTimerRef.current = setTimeout(() => {
      const currentStep = getCurrentStep();
      if (currentStep) {
        setBotMessages(prev => [
          ...prev,
          `⏰ Falta pouco! Completa o passo "${STEPS.find(s => s.key === currentStep)?.label}" para começar a usar o sistema.`,
        ]);
      }
    }, 30000);

    return () => {
      if (reengageTimerRef.current) clearTimeout(reengageTimerRef.current);
    };
  }, [completed, dismissed, visible]);

  const allDone = completed.client && completed.vehicle && completed.quote;
  const completedCount = Object.values(completed).filter(Boolean).length;
  const progress = (completedCount / 3) * 100;

  const getCurrentStep = (): Step | null => {
    if (!completed.client) return "client";
    if (!completed.vehicle) return "vehicle";
    if (!completed.quote) return "quote";
    return null;
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  // Auto-dismiss when all done (after 15s)
  useEffect(() => {
    if (allDone && !dismissed) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [allDone, dismissed]);

  // Don't render if dismissed or not yet visible
  if (dismissed || !visible) return null;

  const currentStep = getCurrentStep();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10 shadow-lg"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            {allDone ? (
              <Rocket className="w-5 h-5 text-primary" />
            ) : (
              <MessageCircle className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-sm">
              {allDone ? "🎉 Configuração Completa!" : "🤖 Configuração Automática"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {allDone
                ? "O GarageFlow está pronto a usar"
                : `Passo ${completedCount + 1} de 3 — ${Math.round(progress)}% concluído`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={progress} className="w-20 h-2" />
          {!allDone && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDismiss(); }}>
              <X className="w-4 h-4" />
            </Button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Bot messages */}
              {botMessages.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {botMessages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-2"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs">🤖</span>
                      </div>
                      <div className="bg-muted/50 rounded-xl rounded-tl-sm px-3 py-2 text-sm">
                        {msg}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Steps */}
              <div className="space-y-2">
                {STEPS.map((step, index) => {
                  const isDone = completed[step.key];
                  const isCurrent = currentStep === step.key;
                  const isLocked = !isDone && !isCurrent;

                  return (
                    <motion.div
                      key={step.key}
                      animate={isCurrent && showNudge ? { scale: [1, 1.02, 1] } : {}}
                      transition={{ repeat: showNudge ? Infinity : 0, duration: 1.5 }}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        isDone
                          ? "border-green-500/30 bg-green-500/5"
                          : isCurrent
                          ? "border-primary/40 bg-primary/5 shadow-sm"
                          : "border-border/50 bg-muted/20 opacity-50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isDone ? "bg-green-500/20" : isCurrent ? "bg-primary/20" : "bg-muted"
                      }`}>
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <step.icon className={`w-4 h-4 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>
                          {index + 1}. {step.label}
                        </p>
                        {isDone && (
                          <p className="text-xs text-green-600">{step.doneMessage}</p>
                        )}
                      </div>

                      {isCurrent && (
                        <Link to={step.href}>
                          <Button size="sm" className="gap-1.5 shadow-md font-bold animate-pulse">
                            FAZER AGORA
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      )}

                      {isDone && !allDone && step.nextMessage && (
                        <span className="text-xs text-muted-foreground hidden sm:block">{step.nextMessage}</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Success state */}
              {allDone && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-4 space-y-2"
                >
                  <div className="text-4xl">🎉</div>
                  <p className="font-bold text-lg">Tudo Pronto!</p>
                  <p className="text-sm text-muted-foreground">
                    O GarageFlow está configurado. Já podes gerir a tua oficina.
                  </p>
                  <Button onClick={handleDismiss} variant="outline" size="sm" className="mt-2">
                    Fechar
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Backup button — renders a "Começar configuração" button if onboarding was dismissed
 * or never appeared. Clicking it resets the dismiss flag and forces the bot to show.
 */
export function OnboardingBackupButton() {
  const [show, setShow] = useState(false);
  const { isReady, user } = useAuthReady();

  useEffect(() => {
    if (!isReady || !user) return;

    const check = async () => {
      const shopId = localStorage.getItem("garageflow_active_shop");
      if (!shopId) {
        setShow(true);
        return;
      }

      const [c, v, q] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("shop_id", shopId).is("deleted_at", null),
        supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("shop_id", shopId).is("deleted_at", null),
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("shop_id", shopId),
      ]);

      const allDone = (c.count ?? 0) > 0 && (v.count ?? 0) > 0 && (q.count ?? 0) > 0;
      if (!allDone) {
        setShow(true);
      }
    };

    check();
  }, [isReady, user]);

  const handleClick = () => {
    localStorage.removeItem(DISMISSED_KEY);
    window.location.reload();
  };

  if (!show) return null;

  // Don't show if bot is already visible (not dismissed)
  if (localStorage.getItem(DISMISSED_KEY) !== "1") return null;

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
    >
      <Rocket className="w-4 h-4" />
      Começar configuração
    </Button>
  );
}
