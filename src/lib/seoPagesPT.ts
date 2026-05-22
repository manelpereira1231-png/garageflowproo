// Conteúdo SEO PT-PT para GarageFlow
// Páginas focadas em intenção real, sem keyword stuffing.

export interface SeoFaq {
  q: string;
  a: string;
}

export interface SeoPageContent {
  slug: string;                 // ex: "software-gestao-oficinas"
  h1: string;
  title: string;                // <title> (≤60 chars)
  description: string;          // meta description (≤160 chars)
  keywords: string;
  intro: string[];              // parágrafos do problema real
  solution: string[];           // parágrafos da solução
  benefits: { title: string; desc: string }[];
  features: { title: string; desc: string }[];
  faqs: SeoFaq[];
  related: { label: string; to: string }[];
  ctaLabel?: string;
}

const COMMON_BENEFITS = [
  { title: "Sem instalação", desc: "Funciona no telemóvel, tablet ou PC. Basta abrir o browser." },
  { title: "Tudo num só sítio", desc: "Clientes, viaturas, orçamentos, ordens de serviço e faturação." },
  { title: "Poupa horas por semana", desc: "Acaba com cadernos, folhas Excel e mensagens perdidas." },
  { title: "Suporte em português", desc: "Falamos a sua língua e conhecemos as oficinas em Portugal." },
];

const COMMON_FEATURES = [
  { title: "Orçamentos digitais", desc: "Crie e envie orçamentos profissionais por email ou WhatsApp em segundos." },
  { title: "Ordens de serviço", desc: "Acompanhe cada reparação com fotos, peças e mão-de-obra." },
  { title: "Histórico por viatura", desc: "Saiba tudo o que foi feito a cada carro, com matrícula e quilometragem." },
  { title: "Faturação simples", desc: "Faturas e recibos prontos a entregar ao cliente." },
  { title: "Agendamentos online", desc: "Os clientes marcam diretamente no link da oficina." },
  { title: "App no telemóvel", desc: "Mecânico atualiza o estado da reparação na hora, com fotos." },
];

const COMMON_FAQS: SeoFaq[] = [
  {
    q: "Preciso de instalar alguma coisa?",
    a: "Não. O GarageFlow funciona diretamente no browser, em qualquer dispositivo. Basta criar conta e começar.",
  },
  {
    q: "Os meus dados ficam seguros?",
    a: "Sim. Os dados são guardados em servidores europeus, com cópias automáticas e acesso protegido por palavra-passe.",
  },
  {
    q: "Posso experimentar gratuitamente?",
    a: "Sim. Tem 30 dias de teste grátis com acesso a todas as funcionalidades, sem cartão de crédito.",
  },
  {
    q: "Funciona em oficinas pequenas?",
    a: "Sim. Foi desenhado tanto para mecânicos independentes como para oficinas com várias rampas e equipa.",
  },
];

export const SEO_PAGES: SeoPageContent[] = [
  // ============ PRINCIPAIS ============
  {
    slug: "software-gestao-oficinas",
    h1: "Software de gestão de oficinas auto",
    title: "Software de Gestão de Oficinas Auto | GarageFlow",
    description: "Software completo para gerir a sua oficina automóvel: clientes, viaturas, orçamentos e faturação. Teste grátis 30 dias.",
    keywords: "software gestão oficinas, software oficina auto, gestão oficina automóvel, programa oficina",
    intro: [
      "Gerir uma oficina automóvel à mão, com cadernos e Excel, faz perder horas todos os dias e clientes ao longo do ano.",
      "Orçamentos demoram demasiado a sair, perdem-se reparações pendentes e ninguém sabe ao certo o que ficou por faturar.",
    ],
    solution: [
      "O GarageFlow centraliza tudo o que a sua oficina precisa: clientes, viaturas, orçamentos, ordens de serviço, faturação e agendamentos.",
      "Foi pensado para mecânicos reais, com linguagem simples e ecrãs claros. Sem manuais nem formações longas.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "ERP para oficinas automóveis", to: "/erp-oficina-automovel" },
      { label: "Alternativa ao Excel para oficinas", to: "/alternativa-excel-oficinas" },
      { label: "Programa de faturação para oficinas", to: "/programa-faturacao-oficinas" },
    ],
  },
  {
    slug: "erp-oficina-automovel",
    h1: "ERP para oficina automóvel",
    title: "ERP para Oficina Automóvel | GarageFlow",
    description: "ERP completo para oficinas: gestão de clientes, viaturas, stock, faturação e ordens de serviço. Teste grátis 30 dias.",
    keywords: "ERP oficina automóvel, ERP oficinas, sistema gestão oficinas, software ERP automóvel",
    intro: [
      "Muitos ERPs no mercado são pesados, caros e foram pensados para fábricas — não para oficinas auto.",
      "O resultado é sempre o mesmo: ninguém usa, e a oficina volta ao caderno e à folha Excel.",
    ],
    solution: [
      "O GarageFlow é um ERP focado em oficinas automóveis. Tem o essencial para correr o negócio sem complicações.",
      "Gestão de clientes, viaturas com histórico, orçamentos, ordens de serviço, stock, faturação e relatórios — tudo ligado.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
      { label: "Programa de faturação para oficinas", to: "/programa-faturacao-oficinas" },
      { label: "Orçamentos digitais para oficinas", to: "/orcamentos-oficina-digital" },
    ],
  },
  {
    slug: "alternativa-excel-oficinas",
    h1: "Alternativa ao Excel para oficinas",
    title: "Alternativa ao Excel para Oficinas | GarageFlow",
    description: "Substitua as folhas Excel por um sistema próprio para oficinas: clientes, viaturas e faturação ligados. Teste grátis.",
    keywords: "alternativa Excel oficinas, software em vez de Excel oficina, sair do Excel oficina",
    intro: [
      "O Excel funciona no início, mas com o tempo torna-se difícil de manter: folhas duplicadas, fórmulas partidas e dados perdidos.",
      "Cada mecânico tem a sua versão e ninguém sabe ao certo qual é a verdadeira.",
    ],
    solution: [
      "O GarageFlow substitui o Excel por uma plataforma própria para oficinas, sem perder a simplicidade.",
      "Tudo fica num só sítio, acessível no telemóvel ou no PC, atualizado em tempo real para toda a equipa.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Software de oficinas vs Excel", to: "/software-oficinas-vs-excel" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
      { label: "Como organizar uma oficina automóvel", to: "/como-organizar-oficina-automovel" },
    ],
  },
  {
    slug: "programa-faturacao-oficinas",
    h1: "Programa de faturação para oficinas",
    title: "Programa de Faturação para Oficinas | GarageFlow",
    description: "Emita faturas e recibos prontos a entregar. Ligado a clientes, viaturas e reparações. Teste grátis 30 dias.",
    keywords: "programa faturação oficinas, faturação oficina, software faturação oficina auto",
    intro: [
      "Faturar à mão ou em programas genéricos obriga a copiar dados de um lado para outro e a perder tempo no final do dia.",
      "Quando falta uma fatura ou um recibo, ninguém sabe onde está.",
    ],
    solution: [
      "Com o GarageFlow, a fatura nasce diretamente da ordem de serviço. Os dados do cliente e da viatura aparecem automaticamente.",
      "Emita, envie por email e tenha tudo organizado por cliente e por mês.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "ERP para oficina automóvel", to: "/erp-oficina-automovel" },
      { label: "Orçamentos digitais para oficinas", to: "/orcamentos-oficina-digital" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
    ],
  },
  {
    slug: "orcamentos-oficina-digital",
    h1: "Orçamentos digitais para oficinas",
    title: "Orçamentos Digitais para Oficinas | GarageFlow",
    description: "Crie e envie orçamentos profissionais em segundos. O cliente aprova online. Teste grátis 30 dias.",
    keywords: "orçamentos oficina, orçamentos digitais oficina, software orçamentos automóvel",
    intro: [
      "Demorar dois dias a enviar um orçamento é perder um cliente para a oficina ao lado.",
      "Quando o orçamento vai escrito à mão ou por SMS, o cliente raramente percebe o que está a pagar.",
    ],
    solution: [
      "O GarageFlow permite criar orçamentos claros, com peças e mão-de-obra discriminadas, em poucos minutos.",
      "O cliente recebe um link, aprova online e o orçamento converte-se automaticamente em ordem de serviço.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Como fazer orçamentos numa oficina", to: "/como-fazer-orcamentos-oficina" },
      { label: "Programa de faturação para oficinas", to: "/programa-faturacao-oficinas" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
    ],
  },

  // ============ PROBLEMA / HOW-TO ============
  {
    slug: "como-gerir-oficina",
    h1: "Como gerir uma oficina automóvel",
    title: "Como Gerir uma Oficina Automóvel | Guia Prático",
    description: "Guia prático para gerir uma oficina auto: clientes, viaturas, orçamentos e faturação sem stress. Ferramenta grátis 30 dias.",
    keywords: "como gerir oficina, gestão oficina automóvel, organizar oficina auto",
    intro: [
      "Gerir uma oficina é muito mais do que reparar carros. É controlar prazos, clientes, peças, recibos e equipa, tudo ao mesmo tempo.",
      "Quem tenta fazer tudo de cabeça acaba a perder dinheiro em pequenos esquecimentos.",
    ],
    solution: [
      "Comece por separar o que é cliente, viatura e reparação. Cada coisa no seu sítio.",
      "Use uma ferramenta que ligue estas três peças e que esteja acessível no telemóvel — é exatamente isto que o GarageFlow faz.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Como organizar uma oficina automóvel", to: "/como-organizar-oficina-automovel" },
      { label: "Como controlar clientes da oficina", to: "/como-controlar-clientes-oficina" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
    ],
  },
  {
    slug: "como-fazer-orcamentos-oficina",
    h1: "Como fazer orçamentos numa oficina",
    title: "Como Fazer Orçamentos numa Oficina | Guia Prático",
    description: "Aprenda a fazer orçamentos claros e profissionais numa oficina automóvel. Modelo digital com aprovação online.",
    keywords: "como fazer orçamentos oficina, modelo orçamento oficina, orçamento reparação automóvel",
    intro: [
      "Muitos orçamentos perdem-se porque demoram demasiado a sair ou são confusos para o cliente.",
      "Uma folha escrita à pressa transmite pouca confiança e dá margem a discussões depois da reparação.",
    ],
    solution: [
      "Um bom orçamento separa peças e mão-de-obra, indica IVA e tem validade clara.",
      "Com o GarageFlow, o orçamento sai em poucos minutos, com a marca da oficina, e o cliente aprova com um clique.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Orçamentos digitais para oficinas", to: "/orcamentos-oficina-digital" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
      { label: "Como gerir uma oficina automóvel", to: "/como-gerir-oficina" },
    ],
  },
  {
    slug: "como-controlar-clientes-oficina",
    h1: "Como controlar clientes da oficina",
    title: "Como Controlar Clientes da Oficina | GarageFlow",
    description: "Mantenha o histórico de cada cliente e viatura organizado. Saiba quem voltou, quem deve e o que falta fazer.",
    keywords: "controlo clientes oficina, ficheiro clientes oficina, base dados clientes oficina",
    intro: [
      "Sem um sistema, é fácil perder contacto com clientes antigos e deixar de lhes lembrar que está na hora da próxima revisão.",
      "Cada cliente perdido é faturação que vai parar à oficina concorrente.",
    ],
    solution: [
      "Tenha uma ficha por cliente com viaturas, histórico de reparações, contactos e estado de cada serviço.",
      "Com o GarageFlow envia lembretes automáticos de revisão e mantém os clientes próximos.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Como gerir uma oficina automóvel", to: "/como-gerir-oficina" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
      { label: "ERP para oficina automóvel", to: "/erp-oficina-automovel" },
    ],
  },
  {
    slug: "como-organizar-oficina-automovel",
    h1: "Como organizar uma oficina automóvel",
    title: "Como Organizar uma Oficina Automóvel | Dicas",
    description: "Dicas práticas para organizar o trabalho diário de uma oficina auto: agenda, ordens de serviço e equipa.",
    keywords: "organizar oficina automóvel, organização oficina, gestão diária oficina",
    intro: [
      "Oficinas desorganizadas perdem horas todos os dias: peças trocadas, ordens de serviço esquecidas e mecânicos parados.",
      "A diferença entre uma oficina rentável e uma oficina apertada está quase sempre na organização.",
    ],
    solution: [
      "Comece por ter uma agenda visível, ordens de serviço com responsável atribuído e estados claros (em espera, em reparação, pronto).",
      "O GarageFlow traz isto tudo já pronto a usar, sem ter de inventar processos do zero.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Como gerir uma oficina automóvel", to: "/como-gerir-oficina" },
      { label: "Alternativa ao Excel para oficinas", to: "/alternativa-excel-oficinas" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
    ],
  },

  // ============ COMPARATIVAS ============
  {
    slug: "software-oficinas-vs-excel",
    h1: "Software de oficinas vs Excel",
    title: "Software de Oficinas vs Excel | Comparação",
    description: "Compare a gestão de oficina em Excel com um software próprio. Veja onde poupa tempo, dinheiro e clientes.",
    keywords: "software oficinas vs Excel, comparação Excel oficina, deixar Excel oficina",
    intro: [
      "O Excel parece grátis, mas custa muito tempo a manter — e ninguém aprende sozinho a usar.",
      "Quando o ficheiro cresce, começam os erros, as cópias perdidas e o medo de tocar nas fórmulas.",
    ],
    solution: [
      "Um software próprio para oficinas, como o GarageFlow, faz tudo o que o Excel faz e muito mais — com app no telemóvel, faturação ligada e agenda online.",
      "Custa pouco por mês e poupa horas por semana.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Alternativa ao Excel para oficinas", to: "/alternativa-excel-oficinas" },
      { label: "Melhor software para oficinas em Portugal", to: "/melhor-software-oficinas-portugal" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
    ],
  },
  {
    slug: "melhor-software-oficinas-portugal",
    h1: "Melhor software para oficinas em Portugal",
    title: "Melhor Software para Oficinas em Portugal | GarageFlow",
    description: "Procura o melhor software para oficinas auto em Portugal? Veja o que deve ter e porque o GarageFlow é a escolha certa.",
    keywords: "melhor software oficinas Portugal, software oficinas Portugal, programa oficinas PT",
    intro: [
      "Há muitos programas para oficinas, mas a maior parte foi feita há 20 anos, com ecrãs confusos e mensalidades caras.",
      "Em Portugal, uma oficina precisa de algo prático, em português, que funcione no telemóvel.",
    ],
    solution: [
      "O GarageFlow foi pensado em Portugal, para oficinas portuguesas, com suporte em português e preço justo.",
      "Junta o essencial: clientes, viaturas, orçamentos, ordens de serviço, faturação e agendamentos.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
      { label: "Software de oficinas vs Excel", to: "/software-oficinas-vs-excel" },
      { label: "ERP para oficina automóvel", to: "/erp-oficina-automovel" },
    ],
  },

  // ============ NOVOS — INTENÇÃO ALTA ============
  {
    slug: "software-oficinas-preco",
    h1: "Software para oficinas — preço",
    title: "Software para Oficinas — Preço | GarageFlow",
    description: "Quanto custa um software de gestão para oficinas auto em Portugal? Veja preços, planos e o que está incluído. Teste grátis 30 dias.",
    keywords: "software oficinas preço, preço software oficina, mensalidade software oficina automóvel",
    intro: [
      "Antes de mudar de sistema, é normal querer saber quanto custa por mês — sem letras pequenas.",
      "Há programas que cobram por utilizador, por viatura ou por fatura emitida — e a conta no fim do mês é uma surpresa.",
    ],
    solution: [
      "O GarageFlow tem planos fixos por mês, sem limite de utilizadores nas versões superiores e sem custos por fatura.",
      "Pode começar grátis, testar tudo durante 30 dias e só depois escolher o plano que faz sentido para a oficina.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
      { label: "Software para oficinas na cloud", to: "/software-oficinas-cloud" },
      { label: "ERP para oficina automóvel", to: "/erp-oficina-automovel" },
    ],
  },
  {
    slug: "software-oficinas-cloud",
    h1: "Software para oficinas na cloud",
    title: "Software para Oficinas na Cloud | GarageFlow",
    description: "Software de oficina 100% na cloud: sem instalação, sem servidor, acessível no telemóvel ou no PC. Teste grátis 30 dias.",
    keywords: "software oficinas cloud, software oficina online, oficina cloud Portugal",
    intro: [
      "Os programas antigos instalados no PC perdem dados quando o computador avaria e não funcionam fora da oficina.",
      "Quem precisa de aceder aos dados fora do balcão, fica preso ao escritório.",
    ],
    solution: [
      "O GarageFlow corre 100% na cloud. Os dados ficam seguros em servidores europeus, com cópias automáticas.",
      "Aceda do telemóvel, tablet ou PC — em qualquer sítio com internet.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
      { label: "Software para oficinas — preço", to: "/software-oficinas-preco" },
      { label: "ERP para oficina automóvel", to: "/erp-oficina-automovel" },
    ],
  },

  // ============ NOVOS — PROBLEMA ============
  {
    slug: "como-gerir-viaturas-oficina",
    h1: "Como gerir viaturas numa oficina",
    title: "Como Gerir Viaturas numa Oficina | GarageFlow",
    description: "Organize as viaturas da oficina com histórico, revisões e fotos. Saiba sempre o estado de cada carro.",
    keywords: "gerir viaturas oficina, histórico viatura oficina, ficheiro viaturas oficina",
    intro: [
      "Sem um sistema, é difícil saber o que foi feito a cada carro — e o cliente acaba a perguntar “já trocaram a correia?”.",
      "Quando os dados estão em cabeças e cadernos, basta um mecânico sair para se perder tudo.",
    ],
    solution: [
      "O GarageFlow guarda cada viatura com matrícula, marca, modelo, quilometragem e histórico completo de reparações.",
      "Com fotos, peças usadas e mão-de-obra — pronto a consultar a qualquer momento.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Como controlar clientes da oficina", to: "/como-controlar-clientes-oficina" },
      { label: "Como organizar uma oficina automóvel", to: "/como-organizar-oficina-automovel" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
    ],
  },

  // ============ NOVOS — COMPARATIVAS ============
  {
    slug: "erp-vs-excel-oficina",
    h1: "ERP vs Excel para oficinas",
    title: "ERP vs Excel para Oficinas | Comparação Honesta",
    description: "Vale a pena trocar o Excel por um ERP na oficina? Veja diferenças reais em tempo, erros e custos.",
    keywords: "ERP vs Excel oficina, trocar Excel ERP oficina, vantagens ERP oficina",
    intro: [
      "O Excel é simples ao início. Mas à medida que a oficina cresce, fica lento, partido e perigoso de partilhar.",
      "Um ERP focado em oficinas resolve isto — mas só vale a pena se for simples de usar.",
    ],
    solution: [
      "O GarageFlow é um ERP pensado para oficinas pequenas e médias em Portugal — sem treino, sem complicações.",
      "Faz tudo o que o Excel faz e ainda liga clientes, viaturas, orçamentos e faturas no mesmo sítio.",
    ],
    benefits: COMMON_BENEFITS,
    features: COMMON_FEATURES,
    faqs: COMMON_FAQS,
    related: [
      { label: "Alternativa ao Excel para oficinas", to: "/alternativa-excel-oficinas" },
      { label: "Software de oficinas vs Excel", to: "/software-oficinas-vs-excel" },
      { label: "ERP para oficina automóvel", to: "/erp-oficina-automovel" },
    ],
  },
];

export const SEO_PAGE_BY_SLUG: Record<string, SeoPageContent> = SEO_PAGES.reduce(
  (acc, p) => ({ ...acc, [p.slug]: p }),
  {}
);

// ============ CIDADES ============
export const SEO_CITIES = [
  { slug: "lisboa", name: "Lisboa", region: "Grande Lisboa" },
  { slug: "porto", name: "Porto", region: "Grande Porto" },
  { slug: "braga", name: "Braga", region: "Minho" },
  { slug: "faro", name: "Faro", region: "Algarve" },
  { slug: "coimbra", name: "Coimbra", region: "Centro" },
  { slug: "aveiro", name: "Aveiro", region: "Centro" },
  { slug: "setubal", name: "Setúbal", region: "Península de Setúbal" },
  { slug: "leiria", name: "Leiria", region: "Centro" },
  { slug: "viseu", name: "Viseu", region: "Centro" },
  { slug: "evora", name: "Évora", region: "Alentejo" },
  { slug: "guimaraes", name: "Guimarães", region: "Minho" },
  { slug: "funchal", name: "Funchal", region: "Madeira" },
];

export const SEO_CITY_BY_SLUG: Record<string, (typeof SEO_CITIES)[number]> =
  SEO_CITIES.reduce((acc, c) => ({ ...acc, [c.slug]: c }), {});
