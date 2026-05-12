import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Upload, Camera, Loader2, CheckCircle, Clock, XCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMarketT } from "@/i18n/marketTranslations";

interface KYCFlowProps {
  userId: string;
  profile: any;
  onComplete: (updated: any) => void;
}

export default function MarketKYCFlow({ userId, profile, onComplete }: KYCFlowProps) {
  const t = useMarketT();
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    nif: profile?.nif || "",
    address: profile?.address || "",
    document_type: profile?.document_type || "cc",
    document_number: profile?.document_number || "",
    document_url: profile?.document_url || "",
    selfie_url: profile?.selfie_url || "",
  });

  const status = profile?.kyc_status || "not_submitted";
  const isLocked = ["submitted", "approved"].includes(status);

  const DOC_TYPES = [
    { value: "cc", label: t("kyc.doc.cc") },
    { value: "passport", label: t("kyc.doc.passport") },
    { value: "driver_license", label: t("kyc.doc.driver") },
  ];

  const uploadFile = async (file: File, kind: "doc" | "selfie") => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("kyc.tooLarge"));
      return;
    }
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("kyc-documents").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(path, 60 * 60 * 24);
      setForm((p) => ({
        ...p,
        [kind === "doc" ? "document_url" : "selfie_url"]: path,
      }));
      (window as any).__kycPreview = {
        ...(window as any).__kycPreview,
        [kind]: signed?.signedUrl,
      };
      toast.success(t("kyc.fileLoaded"));
    } catch (e: any) {
      toast.error(e.message || t("kyc.uploadError"));
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.nif || form.nif.length < 9) return toast.error(t("kyc.invalidNif"));
    if (!form.address) return toast.error(t("kyc.needAddress"));
    if (!form.document_number) return toast.error(t("kyc.needDocNum"));
    if (!form.document_url) return toast.error(t("kyc.needDocPhoto"));
    if (!form.selfie_url) return toast.error(t("kyc.needSelfie"));

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("market-kyc-auto-verify", {
        body: { ...form },
      });
      if (error) throw error;
      if (data?.status === "approved") {
        toast.success("Identidade verificada ✓");
        onComplete(data.profile);
      } else {
        toast.error(data?.reason || "Verificação falhou. Tenta novamente.");
        if (data?.profile) onComplete(data.profile);
      }
    } catch (e: any) {
      toast.error(e.message || t("kyc.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "approved") {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <CardContent className="pt-5 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">
              {t("kyc.verified.title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("kyc.verified.desc")}
            </p>
          </div>
          <Badge className="ml-auto bg-emerald-600 text-white">KYC ✓</Badge>
        </CardContent>
      </Card>
    );
  }

  if (status === "submitted") {
    return (
      <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
        <CardContent className="pt-5 flex items-center gap-3">
          <Clock className="h-6 w-6 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              {t("kyc.review.title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("kyc.review.desc")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardContent className="pt-5 space-y-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base">{t("kyc.intro.title")}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("kyc.intro.desc")}
            </p>
          </div>
        </div>

        {status === "rejected" && profile?.kyc_rejection_reason && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-red-800 dark:text-red-300">{t("kyc.rejected.title")}</p>
              <p className="text-red-700 dark:text-red-400 mt-0.5">{profile.kyc_rejection_reason}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{t("kyc.field.nif")} *</Label>
            <Input
              value={form.nif}
              onChange={(e) => setForm((p) => ({ ...p, nif: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
              placeholder="123456789"
              disabled={isLocked}
            />
          </div>
          <div>
            <Label>{t("kyc.field.address")} *</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder={t("kyc.field.addressPh")}
              disabled={isLocked}
            />
          </div>
          <div>
            <Label>{t("kyc.field.docType")} *</Label>
            <Select
              value={form.document_type}
              onValueChange={(v) => setForm((p) => ({ ...p, document_type: v }))}
              disabled={isLocked}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("kyc.field.docNum")} *</Label>
            <Input
              value={form.document_number}
              onChange={(e) => setForm((p) => ({ ...p, document_number: e.target.value }))}
              placeholder={t("kyc.field.docNumPh")}
              disabled={isLocked}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FileSlot
            label={t("kyc.slot.doc")}
            icon={<FileText className="h-4 w-4" />}
            uploaded={!!form.document_url}
            uploading={uploading === "doc"}
            onChange={(f) => uploadFile(f, "doc")}
            help={t("kyc.slot.docHelp")}
            uploadingLabel={t("kyc.slot.uploading")}
            replaceLabel={t("kyc.slot.replace")}
            uploadLabel={t("kyc.slot.upload")}
          />
          <FileSlot
            label={t("kyc.slot.selfie")}
            icon={<Camera className="h-4 w-4" />}
            uploaded={!!form.selfie_url}
            uploading={uploading === "selfie"}
            onChange={(f) => uploadFile(f, "selfie")}
            help={t("kyc.slot.selfieHelp")}
            uploadingLabel={t("kyc.slot.uploading")}
            replaceLabel={t("kyc.slot.replace")}
            uploadLabel={t("kyc.slot.upload")}
          />
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-[10px] text-muted-foreground max-w-md">
            {t("kyc.privacy")}
          </p>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading !== null}
            className="bg-amber-500 hover:bg-amber-400 text-slate-900"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            {t("kyc.submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FileSlot({
  label, icon, uploaded, uploading, onChange, help,
  uploadingLabel, replaceLabel, uploadLabel,
}: {
  label: string; icon: React.ReactNode; uploaded: boolean; uploading: boolean;
  onChange: (f: File) => void; help: string;
  uploadingLabel: string; replaceLabel: string; uploadLabel: string;
}) {
  return (
    <label className={`block border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${uploaded ? "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20" : "border-border hover:border-amber-400"}`}>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])}
        disabled={uploading}
      />
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="font-semibold text-sm">{label} *</span>
        {uploaded && <CheckCircle className="h-4 w-4 text-emerald-600 ml-auto" />}
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">{help}</p>
      <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        {uploading ? uploadingLabel : uploaded ? replaceLabel : uploadLabel}
      </div>
    </label>
  );
}
