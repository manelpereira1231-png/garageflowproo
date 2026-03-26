import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eraser, Check, PenTool } from "lucide-react";

interface SignaturePadProps {
  onSign: (signatureData: string, signerName: string) => void;
  disabled?: boolean;
  labels: {
    title: string;
    signerName: string;
    signerNamePlaceholder: string;
    clear: string;
    confirm: string;
    drawHere: string;
    required: string;
  };
}

export default function SignaturePad({ onSign, disabled, labels }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState("");

  const getCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas;
  }, []);

  const getCtx = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return null;
    return canvas.getContext("2d");
  }, [getCanvas]);

  useEffect(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = "#1a1a2e";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
      }
    };
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [getCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = getCanvas();
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = getCanvas();
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    const canvas = getCanvas();
    if (!canvas || !hasDrawn || !signerName.trim()) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSign(dataUrl, signerName.trim());
  };

  return (
    <div className="space-y-4 border border-primary/20 rounded-xl p-4 sm:p-6 bg-primary/5">
      <div className="flex items-center gap-2">
        <PenTool className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">{labels.title}</h3>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">{labels.signerName} *</label>
        <Input
          value={signerName}
          onChange={e => setSignerName(e.target.value)}
          placeholder={labels.signerNamePlaceholder}
          disabled={disabled}
          className="max-w-sm"
        />
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">{labels.drawHere}</p>
        <div className="relative border-2 border-dashed border-primary/30 rounded-xl overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="w-full touch-none cursor-crosshair"
            style={{ height: "160px" }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-muted-foreground/40 text-sm">{labels.drawHere}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          disabled={disabled || !hasDrawn}
        >
          <Eraser className="w-4 h-4 mr-1.5" />
          {labels.clear}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          disabled={disabled || !hasDrawn || !signerName.trim()}
          className="bg-success hover:bg-success/90 text-white"
        >
          <Check className="w-4 h-4 mr-1.5" />
          {labels.confirm}
        </Button>
      </div>

      {(!hasDrawn || !signerName.trim()) && (
        <p className="text-xs text-muted-foreground italic">{labels.required}</p>
      )}
    </div>
  );
}
