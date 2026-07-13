import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  start: number;
  onPageChange: (page: number) => void;
  labelOf?: string;
}

export function TablePagination({ page, totalPages, total, pageSize, start, onPageChange, labelOf = "de" }: Props) {
  if (total <= pageSize) return null;
  const end = Math.min(start + pageSize, total);
  return (
    <div className="flex items-center justify-between mt-4 gap-2 flex-wrap">
      <p className="text-sm text-muted-foreground">
        {start + 1}–{end} {labelOf} {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(0)} aria-label="Primeira">
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)} aria-label="Anterior">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground px-2 tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} aria-label="Seguinte">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)} aria-label="Última">
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
