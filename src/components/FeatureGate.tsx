import React from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFeature } from "@/lib/features";
import { useIsChildShop } from "@/hooks/useIsChildShop";

interface FeatureGateProps {
  feature: string;
  /** Plan label shown in upgrade card (default: Pro). */
  requiredPlan?: "pro" | "garage";
  /** Show inline lock card instead of blurred preview. */
  inline?: boolean;
  children: React.ReactNode;
}

const PLAN_LABELS: Record<string, string> = { pro: "Pro", garage: "Garage" };

/**
 * Hides a feature behind the plan matrix (`plan_features` table).
 *
 * Works for both route-level guards and inline UI sections.
 * Source of truth lives in the DB — admins can toggle features
 * without a deploy via `/admin/settings`.
 */
export default function FeatureGate({
  feature,
  requiredPlan = "garage",
  inline = false,
  children,
}: FeatureGateProps) {
  const { allowed, loaded } = useFeature(feature);
  const { isChildShop } = useIsChildShop();

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (allowed) return <>{children}</>;

  const card = (
    <Card className="max-w-md w-full border-primary/20 bg-card/95">
      <CardContent className="py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Funcionalidade bloqueada</h2>
        <p className="text-sm text-muted-foreground">
          {isChildShop
            ? "Esta funcionalidade não está incluída na licença da empresa. Contacte a Oficina Mãe."
            : <>Esta área requer o plano <strong>{PLAN_LABELS[requiredPlan]}</strong> ou superior.</>}
        </p>
        {!isChildShop && (
          <Link to="/billing">
            <Button className="mt-2">Fazer upgrade</Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );

  if (inline) {
    return <div className="flex items-center justify-center py-8">{card}</div>;
  }

  return (
    <div className="relative min-h-[50vh]">
      <div className="pointer-events-none min-h-[50vh] select-none opacity-40 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/50 p-4 backdrop-blur-[1px]">
        {card}
      </div>
    </div>
  );
}
