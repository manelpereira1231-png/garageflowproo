import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface EmptyStateProps {
  /** Emoji or icon node shown above the title */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** CTA label. If omitted, no button is rendered. */
  actionLabel?: string;
  onAction?: () => void;
  /** Render a custom action node (overrides actionLabel/onAction button). */
  action?: ReactNode;
  /** Smaller inline variant (used inside tables/cards instead of full page). */
  variant?: "page" | "inline";
  className?: string;
}

/**
 * Standardized empty state. Use INSTEAD of plain "Sem dados" text.
 * Mirrors the polished pattern already used on Vehicles/Quotes/Clients.
 */
export default function EmptyState({
  icon = "📭",
  title,
  description,
  actionLabel,
  onAction,
  action,
  variant = "page",
  className = "",
}: EmptyStateProps) {
  if (variant === "inline") {
    return (
      <div
        className={`text-center py-8 text-muted-foreground text-sm bg-card border border-border rounded-xl p-5 ${className}`}
      >
        <span className="text-2xl block mb-2">{icon}</span>
        <p className="font-medium text-foreground">{title}</p>
        {description && <p className="text-xs mt-1">{description}</p>}
        {action ?? (actionLabel && onAction && (
          <Button size="sm" onClick={onAction} className="mt-3">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            {actionLabel}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`text-center py-10 sm:py-14 bg-card border-2 border-dashed border-primary/20 rounded-2xl mb-4 animate-fade-in ${className}`}
    >
      <span className="text-4xl sm:text-5xl block mb-3">{icon}</span>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
          {description}
        </p>
      )}
      {action ?? (actionLabel && onAction && (
        <Button size="lg" onClick={onAction} className="px-6">
          <Plus className="w-4 h-4 mr-2" />
          {actionLabel}
        </Button>
      ))}
    </div>
  );
}
