// Blog SEO PT-PT — long-tail keywords, autoridade de domínio.
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  category: "Gestão" | "Faturação" | "Clientes" | "Viaturas" | "Produtividade" | "ERP";
  excerpt: string;
  readingMinutes: number;
  publishedAt: string; // ISO
  sections: { h2: string; body: string[] }[];
  related: { label: string; to: string }[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "como-organizar-uma-oficina-automovel",
    title: "Como organizar uma oficina automóvel sem perder horas todos os dias",
    description: "Guia prático para organizar o trabalho diário de uma oficina automóvel: agenda, ordens de serviço, equipa e clientes.",
    category: "Gestão",
    excerpt: "Uma oficina organizada fatura mais, sem trabalhar mais. Veja como pôr ordem no caos diário com passos simples.",
    readingMinutes: 6,
    publishedAt: "2026-05-01",
    sections: [
      {
        h2: "O preço real da desorganização",
        body: [
          "Quando ninguém sabe ao certo o estado de cada reparação, perde-se tempo em telefonemas e em discussões com clientes.",
          "Cada hora gasta a procurar uma ordem de serviço é uma hora que não foi faturada.",
        ],
      },
      {
        h2: "Os três pilares de uma oficina organizada",
        body: [
          "Primeiro: separar cliente, viatura e reparação. Cada coisa tem o seu lugar.",
          "Segundo: ter uma agenda visível, partilhada com toda a equipa.",
          "Terceiro: estados claros para cada serviço — em espera, em reparação, pronto a entregar.",
        ],
      },
      {
        h2: "Como o GarageFlow ajuda",
        body: [
          "O GarageFlow traz estes três pilares já prontos a usar. Sem ter de inventar processos do zero.",
          "Comece com a versão grátis e veja em poucos dias a diferença.",
        ],
      },
    ],
    related: [
      { label: "Como gerir uma oficina automóvel", to: "/como-gerir-oficina" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
    ],
  },
  {
    slug: "como-reduzir-erros-em-orcamentos",
    title: "Como reduzir erros em orçamentos de oficina",
    description: "Erros em orçamentos custam dinheiro e clientes. Veja como evitar enganos com peças, mão-de-obra e IVA.",
    category: "Faturação",
    excerpt: "Um orçamento com erros é um cliente perdido. Aprenda a fazer orçamentos claros e sem surpresas.",
    readingMinutes: 5,
    publishedAt: "2026-05-04",
    sections: [
      {
        h2: "Os erros mais comuns",
        body: [
          "Esquecer materiais pequenos, esquecer o IVA, confundir tempo de mão-de-obra com tempo de espera de peça.",
          "Quando o cliente recebe a fatura com valor diferente do orçamento, perde a confiança.",
        ],
      },
      {
        h2: "Modelo simples e fiável",
        body: [
          "Separe sempre: peças, mão-de-obra, IVA e validade.",
          "Use um modelo digital — assim o cliente aprova online e fica registado.",
        ],
      },
    ],
    related: [
      { label: "Orçamentos digitais para oficinas", to: "/orcamentos-oficina-digital" },
      { label: "Como fazer orçamentos numa oficina", to: "/como-fazer-orcamentos-oficina" },
    ],
  },
  {
    slug: "oficina-ainda-usa-excel",
    title: "A sua oficina ainda usa Excel? Veja porque está a perder tempo",
    description: "O Excel parece grátis, mas custa horas todos os meses. Veja porquê e como sair em poucos dias.",
    category: "ERP",
    excerpt: "O Excel foi útil no início. Hoje, custa-lhe mais do que pensa. Veja o que muda quando troca para um software próprio.",
    readingMinutes: 5,
    publishedAt: "2026-05-08",
    sections: [
      {
        h2: "O custo escondido do Excel",
        body: [
          "Ficheiros que ninguém sabe qual é a versão certa. Fórmulas partidas. Dados perdidos.",
          "Quando o ficheiro cresce, ninguém mais lhe quer tocar.",
        ],
      },
      {
        h2: "O que ganha ao trocar",
        body: [
          "App no telemóvel, faturação ligada, agenda online, alertas automáticos.",
          "Tudo no mesmo sítio, acessível pela equipa em qualquer altura.",
        ],
      },
    ],
    related: [
      { label: "Alternativa ao Excel para oficinas", to: "/alternativa-excel-oficinas" },
      { label: "Software de oficinas vs Excel", to: "/software-oficinas-vs-excel" },
    ],
  },
  {
    slug: "como-controlar-revisoes-automovel",
    title: "Como controlar revisões automóvel sem perder clientes",
    description: "Lembretes automáticos de revisão são o caminho mais simples para clientes que voltam sempre.",
    category: "Clientes",
    excerpt: "Quase metade dos clientes não volta porque ninguém lhes lembra que está na hora. Resolva isso hoje.",
    readingMinutes: 4,
    publishedAt: "2026-05-12",
    sections: [
      {
        h2: "O cliente esquece — a oficina não pode esquecer",
        body: [
          "A maioria dos condutores só pensa na revisão quando o carro avaria. Aí, vai à oficina mais próxima.",
          "Quem envia lembretes na altura certa, ganha o cliente para sempre.",
        ],
      },
      {
        h2: "Como automatizar",
        body: [
          "Tenha uma ficha por viatura com data da última revisão e quilometragem.",
          "O GarageFlow envia mensagem automática quando se aproxima a próxima.",
        ],
      },
    ],
    related: [
      { label: "Como controlar clientes da oficina", to: "/como-controlar-clientes-oficina" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
    ],
  },
  {
    slug: "como-aumentar-produtividade-oficina",
    title: "Como aumentar a produtividade numa oficina automóvel",
    description: "Dicas práticas para fazer mais reparações por dia, com menos stress e sem contratar mais mecânicos.",
    category: "Produtividade",
    excerpt: "Mais produtividade não é trabalhar mais horas. É deixar de perder tempo onde não interessa.",
    readingMinutes: 6,
    publishedAt: "2026-05-15",
    sections: [
      {
        h2: "Onde se perde tempo todos os dias",
        body: [
          "Telefonemas a clientes para confirmar levantamentos. Procura de peças que ninguém sabe onde estão.",
          "Discussões internas sobre quem fica com cada carro.",
        ],
      },
      {
        h2: "Pequenas mudanças, grande impacto",
        body: [
          "Estados de serviço claros. Mensagens automáticas quando o carro está pronto. Stock controlado.",
          "Em poucas semanas, ganha uma hora por dia por mecânico.",
        ],
      },
    ],
    related: [
      { label: "Como organizar uma oficina automóvel", to: "/como-organizar-oficina-automovel" },
      { label: "ERP para oficina automóvel", to: "/erp-oficina-automovel" },
    ],
  },
  {
    slug: "como-gerir-clientes-recorrentes",
    title: "Como gerir clientes recorrentes numa oficina automóvel",
    description: "Clientes recorrentes são o motor da oficina. Veja como mantê-los próximos sem esforço.",
    category: "Clientes",
    excerpt: "Custa cinco vezes menos manter um cliente do que ganhar um novo. Veja como fazer.",
    readingMinutes: 5,
    publishedAt: "2026-05-19",
    sections: [
      {
        h2: "Conheça quem volta",
        body: [
          "Saber quantas vezes cada cliente já cá esteve mostra de onde vem o lucro real.",
          "Os clientes recorrentes gastam mais e recomendam.",
        ],
      },
      {
        h2: "Mantê-los próximos",
        body: [
          "Lembretes de revisão, descontos pequenos para a segunda visita, mensagem de aniversário do carro.",
          "Tudo isto pode ser automático com a ferramenta certa.",
        ],
      },
    ],
    related: [
      { label: "Como controlar clientes da oficina", to: "/como-controlar-clientes-oficina" },
      { label: "Software de gestão de oficinas", to: "/software-gestao-oficinas" },
    ],
  },
];

export const BLOG_BY_SLUG: Record<string, BlogPost> = BLOG_POSTS.reduce(
  (acc, p) => ({ ...acc, [p.slug]: p }),
  {}
);
