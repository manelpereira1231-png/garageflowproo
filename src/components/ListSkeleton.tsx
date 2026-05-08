interface Props {
  rows?: number;
  /** Show a card-style skeleton for mobile / list views */
  variant?: "card" | "row";
}

/**
 * Premium shimmer placeholder for list pages.
 * Use INSTEAD of the empty state while data is still being fetched.
 */
const Bar = ({ className = "" }: { className?: string }) => (
  <div
    className={`relative overflow-hidden rounded-md bg-muted/60 ${className}`}
  >
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
  </div>
);

export default function ListSkeleton({ rows = 5, variant = "card" }: Props) {
  if (variant === "row") {
    return (
      <div className="space-y-2 animate-fade-in">
        {Array.from({ length: rows }).map((_, i) => (
          <Bar key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2 animate-fade-in">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Bar className="h-4 w-32" />
            <Bar className="h-7 w-20 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Bar className="h-3 w-24" />
            <Bar className="h-3 w-20" />
            <Bar className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
