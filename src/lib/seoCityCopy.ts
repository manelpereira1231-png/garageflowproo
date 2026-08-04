// Copy PT-PT das páginas SEO por cidade — partilhado entre a página React e o pré-render estático (build-time SSG).
export type Intent = "oficinas" | "gestao-oficinas" | "erp-automovel" | "software-oficinas";

export function detectIntent(pathname: string): Intent {
  if (pathname.startsWith("/gestao-oficinas/")) return "gestao-oficinas";
  if (pathname.startsWith("/erp-automovel/")) return "erp-automovel";
  if (pathname.startsWith("/software-oficinas/")) return "software-oficinas";
  return "oficinas";
}

export const INTENT_COPY: Record<Intent, {
  prefix: string;
  h1: (city: string) => string;
  title: (city: string) => string;
  description: (city: string, region: string) => string;
  intro: (city: string, region: string) => string[];
  solution: (city: string, region: string) => string[];
  uniqueFaq: (city: string) => { q: string; a: string };
}> = {
  "oficinas": {
    prefix: "oficinas",
    h1: (c) => `Software para oficinas em ${c}`,
    title: (c) => `Software para Oficinas em ${c} | GarageFlow`,
    description: (c, r) => `Software de gestão para oficinas auto em ${c} (${r}). Orçamentos, faturação e clientes num só sítio. Teste grátis 30 dias.`,
    intro: (c) => [
      `As oficinas em ${c} enfrentam todos os dias o mesmo desafio: muito trabalho, pouca organização e pouco tempo para faturar tudo o que se faz.`,
      `Quem trabalha à mão ou em folhas Excel perde horas por semana — e perde clientes que não voltam.`,
    ],
    solution: (c, r) => [
      `O GarageFlow é usado por oficinas em ${r} para organizar clientes, viaturas, orçamentos e faturação num só sítio.`,
      `Está disponível no telemóvel e no PC, em português, e pode ser experimentado gratuitamente durante 30 dias.`,
    ],
    uniqueFaq: (c) => ({
      q: `O GarageFlow funciona em oficinas pequenas em ${c}?`,
      a: `Sim. Funciona desde mecânicos independentes em ${c} até oficinas com várias rampas e equipa.`,
    }),
  },
  "gestao-oficinas": {
    prefix: "gestao-oficinas",
    h1: (c) => `Gestão de oficinas auto em ${c}`,
    title: (c) => `Gestão de Oficinas em ${c} | GarageFlow`,
    description: (c, r) => `Ferramenta de gestão para oficinas auto em ${c} e ${r}: clientes, orçamentos, agenda e faturação. Grátis 30 dias.`,
    intro: (c) => [
      `Gerir uma oficina em ${c} significa equilibrar reparações urgentes, clientes a ligar e mecânicos a precisar de peças — tudo ao mesmo tempo.`,
      `Sem uma ferramenta certa, perde-se controlo do que está em curso e do que ficou por faturar.`,
    ],
    solution: (c, r) => [
      `O GarageFlow centraliza a gestão diária de oficinas em ${r}: agenda, ordens de serviço, clientes, viaturas e faturação.`,
      `Sem instalação. Funciona em qualquer dispositivo, em português, com suporte a partir de Portugal.`,
    ],
    uniqueFaq: (c) => ({
      q: `Como ajuda na gestão diária de uma oficina em ${c}?`,
      a: `Centraliza a agenda, os mecânicos atribuídos a cada carro e o estado de cada reparação — tudo visível em tempo real para a equipa.`,
    }),
  },
  "erp-automovel": {
    prefix: "erp-automovel",
    h1: (c) => `ERP para oficinas automóveis em ${c}`,
    title: (c) => `ERP para Oficinas Auto em ${c} | GarageFlow`,
    description: (c, r) => `ERP para oficinas auto em ${c} (${r}): stock, ordens de serviço, faturação e relatórios. Teste grátis 30 dias.`,
    intro: (c) => [
      `Em ${c}, muitas oficinas usam folhas Excel ou programas antigos para tentar fazer de ERP — sem sucesso.`,
      `Resultado: dados perdidos, stock desatualizado e relatórios que ninguém consulta.`,
    ],
    solution: (c, r) => [
      `O GarageFlow é um ERP simples, focado em oficinas auto em ${r}. Tem stock, ordens de serviço, faturação e relatórios — tudo ligado.`,
      `Pensado para ser usado por mecânicos, não por contabilistas.`,
    ],
    uniqueFaq: (c) => ({
      q: `Vale a pena ter um ERP numa oficina em ${c}?`,
      a: `Sim — assim que tem stock, mais de um mecânico ou mais de 30 viaturas por mês. Um ERP simples paga-se em poucas semanas.`,
    }),
  },
  "software-oficinas": {
    prefix: "software-oficinas",
    h1: (c) => `Software para oficinas em ${c}`,
    title: (c) => `Software para Oficinas em ${c} | GarageFlow`,
    description: (c, r) => `Software cloud para oficinas auto em ${c} e ${r}. Sem instalação, sem servidor, com app no telemóvel. Grátis 30 dias.`,
    intro: (c) => [
      `As oficinas em ${c} já não precisam de programas instalados no PC do escritório.`,
      `Hoje, o trabalho passa pelo telemóvel — desde receber a viatura até entregar a fatura.`,
    ],
    solution: (c, r) => [
      `O GarageFlow é um software 100% cloud, usado por oficinas em ${r}. Sem servidor, sem instalação, com app no telemóvel.`,
      `Os dados ficam seguros, com cópias automáticas e acesso protegido.`,
    ],
    uniqueFaq: (c) => ({
      q: `É preciso instalar alguma coisa em ${c}?`,
      a: `Não. Basta criar conta no site do GarageFlow e começar a usar — em qualquer telemóvel, tablet ou PC.`,
    }),
  },
};
