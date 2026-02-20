import { TrendingUp, FileText, Wrench, Users, DollarSign, BarChart3 } from "lucide-react";

const stats = [
  { label: "Faturação Mês", value: "€0", icon: DollarSign, trend: "+0%" },
  { label: "Lucro Mês", value: "€0", icon: TrendingUp, trend: "+0%" },
  { label: "Serviços Mês", value: "0", icon: Wrench, trend: "0" },
  { label: "Ticket Médio", value: "€0", icon: BarChart3, trend: "€0" },
  { label: "Orçamentos Abertos", value: "0", icon: FileText, trend: "0 pendentes" },
  { label: "Clientes Ativos", value: "0", icon: Users, trend: "total" },
];

export default function Dashboard() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral da oficina</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="w-4.5 h-4.5 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.trend}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Novo Cliente", icon: Users, href: "/clients" },
            { label: "Novo Veículo", icon: "🚗", href: "/vehicles" },
            { label: "Novo Orçamento", icon: FileText, href: "/quotes" },
            { label: "Novo Serviço", icon: Wrench, href: "/services" },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border 
                hover:border-primary/30 hover:bg-primary/5 transition-all text-center group"
            >
              {typeof action.icon === 'string' ? (
                <span className="text-2xl">{action.icon}</span>
              ) : (
                <action.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
              <span className="text-sm font-medium">{action.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
