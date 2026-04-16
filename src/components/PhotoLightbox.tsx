import { useEffect, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhotoLightboxProps {
  photos: string[];
  open: boolean;
  initialIndex?: number;
  onClose: () => void;
}

export default function PhotoLightbox({ photos, open, initialIndex = 0, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setIndex(initialIndex);
    setZoom(1);
  }, [initialIndex, open]);

  const next = useCallback(() => {
    setZoom(1);
    setIndex((i) => (i + 1) % photos.length);
  }, [photos.length]);

  const prev = useCallback(() => {
    setZoom(1);
    setIndex((i) => (i - 1 + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 3));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 1));
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, next, prev, onClose]);

  if (!open || photos.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Galeria de fotos do veículo"
    >
      {/* Top bar */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-slate-950/90 to-transparent z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white/80 text-sm font-medium">
          {index + 1} / {photos.length}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => setZoom((z) => Math.max(z - 0.25, 1))}
            aria-label="Reduzir zoom"
            disabled={zoom <= 1}
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <span className="text-white/80 text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
            aria-label="Aumentar zoom"
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={onClose}
            aria-label="Fechar galeria"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Prev */}
      {photos.length > 1 && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute left-4 z-10 text-white hover:bg-white/10 h-12 w-12"
          onClick={(e) => {
            e.stopPropagation();
            prev();
          }}
          aria-label="Foto anterior"
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[85vh] overflow-auto flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photos[index]}
          alt={`Foto ${index + 1} de ${photos.length}`}
          className={cn(
            "max-w-full max-h-[85vh] object-contain transition-transform duration-200 select-none",
            zoom > 1 && "cursor-move"
          )}
          style={{ transform: `scale(${zoom})` }}
          draggable={false}
        />
      </div>

      {/* Next */}
      {photos.length > 1 && (
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-4 z-10 text-white hover:bg-white/10 h-12 w-12"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
          aria-label="Próxima foto"
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div
          className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-950/90 to-transparent"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-2 justify-center overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <button
                key={i}
                onClick={() => {
                  setZoom(1);
                  setIndex(i);
                }}
                className={cn(
                  "h-14 w-20 flex-shrink-0 rounded overflow-hidden border-2 transition",
                  i === index ? "border-amber-400 opacity-100" : "border-white/20 opacity-60 hover:opacity-100"
                )}
                aria-label={`Ver foto ${i + 1}`}
              >
                <img src={p} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
