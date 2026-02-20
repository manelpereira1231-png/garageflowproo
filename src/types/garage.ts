export interface Shop {
  id: string;
  user_id: string;
  name: string;
  logo_url?: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
  vat_rate: number;
  labor_rate: number;
  language: string;
  created_at: string;
}

export interface Client {
  id: string;
  shop_id: string;
  name: string;
  phone: string;
  email: string;
  company?: string;
  nif?: string;
  notes?: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  shop_id: string;
  client_id: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  vin?: string;
  mileage: number;
  fuel: string;
  notes?: string;
  created_at: string;
  client?: Client;
}

export interface ServiceCatalog {
  id: string;
  shop_id: string;
  name: string;
  description?: string;
  default_time: number;
  default_price: number;
  internal_cost: number;
  vat_rate: number;
  recurrence_km?: number;
  recurrence_months?: number;
}

export interface Part {
  id: string;
  shop_id: string;
  name: string;
  reference?: string;
  internal_cost: number;
  sale_price: number;
  vat_rate: number;
  active: boolean;
}

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'converted';
export type ServiceStatus = 'open' | 'diagnosis' | 'waiting_approval' | 'approved' | 'in_progress' | 'completed' | 'delivered' | 'cancelled';

export interface QuoteLine {
  id: string;
  type: 'service' | 'part';
  name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  vat_rate: number;
}

export interface Quote {
  id: string;
  shop_id: string;
  number: string;
  date: string;
  validity_date: string;
  client_id: string;
  vehicle_id: string;
  lines: QuoteLine[];
  subtotal: number;
  vat_total: number;
  total: number;
  cost_total: number;
  profit: number;
  status: QuoteStatus;
  notes?: string;
  token?: string;
  created_at: string;
  client?: Client;
  vehicle?: Vehicle;
}

export interface WorkOrder {
  id: string;
  shop_id: string;
  number: string;
  origin: 'manual' | 'quote';
  quote_id?: string;
  client_id: string;
  vehicle_id: string;
  entry_mileage: number;
  client_description?: string;
  diagnosis?: string;
  lines: QuoteLine[];
  labor_hours: number;
  technician?: string;
  subtotal: number;
  vat_total: number;
  total: number;
  cost_total: number;
  profit: number;
  status: ServiceStatus;
  notes?: string;
  created_at: string;
  completed_at?: string;
  delivered_at?: string;
  client?: Client;
  vehicle?: Vehicle;
}

export const VAT_RATES: Record<string, number> = {
  'Portugal': 23,
  'Espanha': 21,
  'França': 20,
};

export const FUEL_TYPES = ['Gasolina', 'Gasóleo', 'Híbrido', 'Elétrico', 'GPL'];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  expired: 'Expirado',
  converted: 'Convertido',
};

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  open: 'Aberto',
  diagnosis: 'Diagnóstico',
  waiting_approval: 'Aguardando Aprovação',
  approved: 'Aprovado',
  in_progress: 'Em Execução',
  completed: 'Concluído',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};
