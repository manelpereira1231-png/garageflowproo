import { useParams, Navigate } from "react-router-dom";
import SeoLandingPage from "./SeoLandingPage";
import { SEO_CITY_BY_SLUG } from "@/lib/seoPagesPT";
import type { SeoPageContent } from "@/lib/seoPagesPT";

/**
 * Página dinâmica /oficinas/:cidade
 * Reutiliza o renderer SeoLandingPage com conteúdo gerado por cidade.
 */
export default function SeoCityPage() {
  const { cidade } = useParams();
  const slug = (cidade || "").toLowerCase();
  const city = SEO_CITY_BY_SLUG[slug];

  if (!city) return <Navigate to="/" replace />;

  const page: SeoPageContent = {
    slug: `oficinas/${city.slug}`,
    h1: `Software para oficinas em ${city.name}`,
    title: `Software para Oficinas em ${city.name} | GarageFlow`,
    description: `Software de gestão para oficinas auto em ${city.name} (${city.region}). Orçamentos, faturação e clientes num só sítio. Teste grátis 30 dias.`,
    keywords: `software oficinas ${city.name}, gestão oficina ${city.name}, ERP oficina ${city.name}, oficinas ${city.name}`,
    intro: [
      `As oficinas em ${city.name} enfrentam todos os dias o mesmo desafio: muito trabalho, pouca organização e pouco tempo para faturar tudo o que se faz.`,
      `Quem trabalha à mão ou em folhas Excel perde horas por semana — e perde clientes que não voltam.`,
    ],
    solution: [
      `O GarageFlow é usado por oficinas em ${city.region} para organizar clientes, viaturas, orçamentos e faturação num só sítio.`,
      `Está disponível no telemóvel e no PC, em português, e pode ser experimentado gratuitamente durante 30 dias.`,
    ],
    benefits: [
      { title: "Pensado em Portugal", desc: "Suporte em português e adaptado à realidade das oficinas portuguesas." },
      { title: "Funciona em qualquer dispositivo", desc: "Telemóvel, tablet ou PC — basta abrir o browser." },
      { title: "Sem instalação", desc: "Crie conta e está a usar em menos de 5 minutos." },
      { title: "Tudo ligado", desc: "Clientes, viaturas, orçamentos e faturas no mesmo sítio." },
    ],
    features: [
      { title: "Orçamentos digitais", desc: "Envie por email ou WhatsApp e o cliente aprova online." },
      { title: "Ordens de serviço", desc: "Acompanhe cada reparação com fotos e materiais." },
      { title: "Histórico por viatura", desc: "Veja tudo o que foi feito a cada carro." },
      { title: "Faturação simples", desc: "Faturas e recibos prontos a entregar." },
      { title: "Agendamentos online", desc: "Os clientes marcam diretamente no link da oficina." },
      { title: "App no telemóvel", desc: "Mecânico atualiza o estado da reparação na hora." },
    ],
    faqs: [
      {
        q: `O GarageFlow funciona para oficinas em ${city.name}?`,
        a: `Sim. O GarageFlow funciona em qualquer oficina em Portugal, incluindo ${city.name} e toda a região de ${city.region}.`,
      },
      {
        q: "Preciso de internet rápida?",
        a: "Não. Funciona bem em ligações normais. O essencial fica disponível mesmo com sinal fraco.",
      },
      {
        q: "Posso experimentar antes de pagar?",
        a: "Sim. 30 dias grátis com acesso a tudo, sem cartão de crédito.",
      },
      {
        q: "Funciona em oficinas pequenas?",
        a: "Sim. Desde mecânicos independentes a oficinas com várias rampas e equipa.",
      },
    ],
    related: [
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
      { label: "ERP para oficina automóvel", to: "/erp-oficina-automovel" },
      { label: "Alternativa ao Excel para oficinas", to: "/alternativa-excel-oficinas" },
    ],
  };

  return <SeoLandingPage page={page} />;
}
