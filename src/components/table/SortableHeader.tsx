import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortState } from "@/hooks/useTableState";

interface Props {
  sortKey: string;
  currentSort: SortState;
  onToggle: (key: string) => void;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}

/**
 * Sortable table header. 3 states cycle on click: asc → desc → none.
 * Renders the current direction icon next to the label.
 */
export function SortableHeader({ sortKey, currentSort, onToggle, children, className, align = "left" }: Props) {
  const isActive = currentSort.key === sortKey && currentSort.dir !== null;
  const Icon = !isActive ? ArrowUpDown : currentSort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead className={cn("px-3", className)}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 select-none hover:text-foreground transition-colors -mx-1 px-1 py-0.5 rounded",
          isActive ? "text-foreground font-semibold" : "text-muted-foreground",
          align === "right" && "ml-auto"
        )}
      >
        <span>{children}</span>
        <Icon className={cn("w-3 h-3", isActive ? "opacity-100" : "opacity-40")} />
      </button>
    </TableHead>
  );
}
