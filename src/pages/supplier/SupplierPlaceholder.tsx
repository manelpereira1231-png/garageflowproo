import { Card, CardContent } from "@/components/ui/card";
import { Rocket } from "lucide-react";

export default function SupplierPlaceholder({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card>
        <CardContent className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Disponível na próxima fase</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {description ?? "Esta área faz parte do plano de evolução da Rede de Fornecedores e será ativada em breve."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
