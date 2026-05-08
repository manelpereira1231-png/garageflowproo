import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  rows?: number;
  /** Show a card-style skeleton for mobile / list views */
  variant?: "card" | "row";
}

/**
 * Lightweight loading placeholder for list pages.
 * Use INSTEAD of the empty state while data is still being fetched.
 */
export default function ListSkeleton({ rows = 5, variant = "card" }: Props) {
  if (variant === "row") {
    return (
      <div className="space-y-2 animate-fade-in">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2 animate-fade-in">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
