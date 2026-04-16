import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileCheck, PenTool, CheckCircle, Clock, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SignaturePad from "./SignaturePad";
import { generateContractPDF } from "@/lib/contractPdf";

interface Props {
  contract: any;
  listing: any;
  isBuyer: boolean;
  isSeller: boolean;
  userId: string;
  onSigned: () => void;
}

const SIG_LABELS = {
  title: "Assinar Contrato Digitalmente",
  signerName: "Nome completo (como no documento de identidade)",
  signerNamePlaceholder: "Ex: João Manuel Silva",
  clear: "Limpar",
  confirm: "Assinar",
  drawHere: "Desenhe a sua assinatura aqui",
  required: "Preencha o nome e desenhe a assinatura para continuar",
};

export default function MarketContractSigning({ contract, listing, isBuyer, isSeller, userId, onSigned }: Props) {
  const [signOpen, setSignOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const buyerSigned = !!contract.buyer_signed_at;
  const sellerSigned = !!contract.seller_signed_at;
  const fullySigned = buyerSigned && sellerSigned;

  const myRole = isBuyer ? "buyer" : isSeller ? "seller" : null;
  const mySigned = isBuyer ? buyerSigned : isSeller ? sellerSigned : false;

  const handleSign = async (signatureData: string, signerName: string) => {
    if (!myRole) return;
    setSigning(true);
    try {
      // Upload PNG to storage (public bucket)
      const blob = await (await fetch(signatureData)).blob();
      const path = `${userId}/${contract.id}-${myRole}-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("market-signatures")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("market-signatures").getPublicUrl(path);
      const signedUrl = pub.publicUrl;

      const updates: any = myRole === "buyer"
        ? { buyer_signed_at: new Date().toISOString(), buyer_signature_url: signedUrl, buyer_snapshot: { ...contract.buyer_snapshot, name: signerName } }
        : { seller_signed_at: new Date().toISOString(), seller_signature_url: signedUrl, seller_snapshot: { ...contract.seller_snapshot, name: signerName } };

      // If both will be signed, mark fully_signed
      const willBeFull = myRole === "buyer" ? sellerSigned : buyerSigned;
      if (willBeFull) updates.signed_status = "fully_signed";
      else updates.signed_status = "partially_signed";

      const { error } = await supabase
        .from("market_contracts")
        .update(updates)
        .eq("id", contract.id);
      if (error) throw error;

      toast.success("Assinatura registada. O contrato foi atualizado.");
      setSignOpen(false);
      onSigned();
    } catch (e: any) {
      toast.error(e.message || "Erro ao assinar");
    } finally {
      setSigning(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      generateContractPDF({
        contract,
        listing,
        buyer: contract.buyer_snapshot || {},
        seller: contract.seller_snapshot || {},
        amount: Number(contract.amount),
      });
      toast.success("Contrato descarregado");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="border-emerald-200 dark:border-emerald-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck className="h-5 w-5 text-emerald-600" />
          Contrato de Compra e Venda
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Nº {contract.contract_number} · Hash {contract.contract_hash?.slice(0, 12)}...
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <SigBadge label="Vendedor" signed={sellerSigned} />
          <SigBadge label="Comprador" signed={buyerSigned} />
        </div>

        {!mySigned && myRole && (
          <Button
            onClick={() => setSignOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <PenTool className="h-4 w-4 mr-2" />
            Assinar como {myRole === "buyer" ? "Comprador" : "Vendedor"}
          </Button>
        )}

        {fullySigned && (
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Contrato totalmente assinado e selado.
            </p>
          </div>
        )}

        <Button
          onClick={handleDownload}
          variant="outline"
          className="w-full"
          disabled={downloading}
        >
          {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Descarregar PDF
        </Button>

        <Dialog open={signOpen} onOpenChange={setSignOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assinatura digital — {myRole === "buyer" ? "Comprador" : "Vendedor"}</DialogTitle>
            </DialogHeader>
            {signing ? (
              <div className="py-12 flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                <p className="text-sm text-muted-foreground">A registar assinatura...</p>
              </div>
            ) : (
              <SignaturePad onSign={handleSign} labels={SIG_LABELS} />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function SigBadge({ label, signed }: { label: string; signed: boolean }) {
  return (
    <div className={`p-2 rounded-md border ${signed ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50/40 dark:bg-amber-950/20"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className={`flex items-center gap-1 mt-0.5 text-xs font-medium ${signed ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-400"}`}>
        {signed ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        {signed ? "Assinado" : "Pendente"}
      </div>
    </div>
  );
}
