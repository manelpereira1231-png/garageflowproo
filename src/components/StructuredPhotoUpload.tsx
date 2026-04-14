import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

export interface PhotoSlot {
  key: string;
  label: string;
  description: string;
  required: boolean;
  url: string | null;
}

const DEFAULT_SLOTS: PhotoSlot[] = [
  { key: "front", label: "Frontal", description: "Vista frontal completa do veículo", required: true, url: null },
  { key: "rear", label: "Traseira", description: "Vista traseira completa", required: true, url: null },
  { key: "left", label: "Lateral Esquerda", description: "Vista lateral esquerda completa", required: true, url: null },
  { key: "right", label: "Lateral Direita", description: "Vista lateral direita completa", required: true, url: null },
  { key: "interior", label: "Interior", description: "Vista geral do habitáculo", required: true, url: null },
  { key: "dashboard", label: "Painel / Km", description: "Painel com quilometragem visível", required: true, url: null },
  { key: "engine", label: "Motor", description: "Compartimento do motor", required: true, url: null },
  { key: "plate", label: "Matrícula", description: "Matrícula do veículo visível", required: true, url: null },
  { key: "overview", label: "Visão Geral", description: "Vista panorâmica do veículo", required: false, url: null },
];

interface StructuredPhotoUploadProps {
  userId: string;
  photos: PhotoSlot[];
  onChange: (photos: PhotoSlot[]) => void;
}

export function getDefaultPhotoSlots(): PhotoSlot[] {
  return DEFAULT_SLOTS.map(s => ({ ...s }));
}

export function getPhotoUrls(slots: PhotoSlot[]): string[] {
  return slots.filter(s => s.url).map(s => s.url!);
}

export function areRequiredPhotosFilled(slots: PhotoSlot[]): boolean {
  return slots.filter(s => s.required).every(s => s.url !== null);
}

export default function StructuredPhotoUpload({ userId, photos, onChange }: StructuredPhotoUploadProps) {
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  const filledCount = photos.filter(s => s.url).length;
  const requiredCount = photos.filter(s => s.required).length;
  const requiredFilled = photos.filter(s => s.required && s.url).length;

  const handleUpload = async (slotKey: string, file: File) => {
    setUploadingSlot(slotKey);
    try {
      const ext = file.name.split('.').pop();
      const path = `${userId}/${slotKey}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("carity-photos").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("carity-photos").getPublicUrl(path);
      
      onChange(photos.map(s => s.key === slotKey ? { ...s, url: urlData.publicUrl } : s));
    } catch (err: any) {
      toast.error("Erro ao carregar foto: " + (err.message || ""));
    } finally {
      setUploadingSlot(null);
    }
  };

  const removePhoto = (slotKey: string) => {
    onChange(photos.map(s => s.key === slotKey ? { ...s, url: null } : s));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Fotos estruturadas: {requiredFilled}/{requiredCount} obrigatórias
          {filledCount > requiredFilled && ` (+${filledCount - requiredFilled} opcional)`}
        </p>
        {requiredFilled === requiredCount && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <Check className="h-3 w-3" /> Completo
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-3 gap-3">
        {photos.map((slot) => (
          <div key={slot.key} className="space-y-1">
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden border-2 border-dashed transition-colors group"
              style={{ borderColor: slot.url ? 'hsl(var(--primary))' : slot.required ? 'hsl(var(--destructive) / 0.4)' : 'hsl(var(--border))' }}>
              
              {slot.url ? (
                <>
                  <img src={slot.url} alt={slot.label} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(slot.key)}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                    <span className="text-[10px] text-white font-medium">{slot.label}</span>
                  </div>
                </>
              ) : (
                <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition p-2">
                  {uploadingSlot === slot.key ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Camera className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">{slot.label}</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(slot.key, file);
                      e.target.value = '';
                    }}
                    disabled={uploadingSlot !== null}
                  />
                </label>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground truncate">{slot.description}</span>
              {slot.required && <span className="text-[10px] text-destructive">*</span>}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        * Campos obrigatórios. As fotos não podem ser editadas após submissão. 
        O upload segue uma estrutura fixa para garantir a transparência e verificação do veículo.
      </p>
    </div>
  );
}
