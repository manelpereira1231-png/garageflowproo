import { CheckCheck, MessageCircle } from "lucide-react";

export default function WhatsAppMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border shadow-xl bg-card flex items-center justify-center p-6 sm:p-8">
      <div className="w-full max-w-[280px] rounded-[28px] border-[6px] border-foreground/85 overflow-hidden shadow-2xl bg-background">
        <div className="h-6 bg-foreground/85" />
        <div className="p-3 bg-[#075E54] text-white flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Oficina Auto Silva</p>
            <p className="text-[10px] opacity-80 leading-tight">online</p>
          </div>
        </div>
        <div className="p-3 space-y-2 bg-[#ECE5DD] min-h-[280px]">
          <div className="bg-white rounded-xl rounded-tl-sm p-2 max-w-[85%] shadow-sm">
            <p className="text-[11px] text-foreground">Olá Maria 👋 O orçamento #1042 está pronto.</p>
            <p className="text-[10px] text-muted-foreground mt-1">Travões + óleo · <span className="font-semibold text-foreground">€ 245,00</span></p>
            <p className="text-[9px] text-muted-foreground/70 text-right mt-1">10:24</p>
          </div>
          <div className="bg-white rounded-xl rounded-tl-sm p-2 max-w-[85%] shadow-sm">
            <p className="text-[11px] text-foreground">Aprova aqui 👇</p>
            <div className="mt-1.5 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-primary text-[10px] font-semibold text-center">
              Aprovar orçamento
            </div>
            <p className="text-[9px] text-muted-foreground/70 text-right mt-1">10:24</p>
          </div>
          <div className="bg-[#DCF8C6] rounded-xl rounded-tr-sm p-2 max-w-[85%] shadow-sm ml-auto">
            <p className="text-[11px] text-foreground">Aprovado ✅</p>
            <p className="text-[9px] text-muted-foreground/70 text-right mt-1 flex items-center justify-end gap-0.5">10:26 <CheckCheck className="w-3 h-3 text-blue-500" /></p>
          </div>
          <div className="bg-white rounded-xl rounded-tl-sm p-2 max-w-[85%] shadow-sm">
            <p className="text-[11px] text-foreground">Obrigado! Carro pronto sexta às 15h 🚗</p>
            <p className="text-[9px] text-muted-foreground/70 text-right mt-1">10:27</p>
          </div>
        </div>
      </div>
    </div>
  );
}
