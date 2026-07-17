// Localized subject + body copy for the child-shop invite email.
// The visual shell is applied by send-email via renderBrandedEmail.

export type InviteLang = "pt" | "es" | "fr" | "en";

const COPY: Record<InviteLang, {
  subject: string;
  preheader: string;
  greeting: (name: string) => string;
  intro: string;
  action: string;
  security: string;
  cta: string;
  footer: string;
}> = {
  pt: {
    subject: "Bem-vindo ao GarageFlow",
    preheader: "Define a tua palavra-passe para começares a utilizar o GarageFlow.",
    greeting: (n) => `Olá ${n},`,
    intro:
      "A tua oficina foi criada no <strong>GarageFlow</strong>. Para acederes à tua conta independente, define agora a tua palavra-passe.",
    action: "Basta clicares no botão abaixo — o link é seguro e temporário.",
    security:
      "Se não estavas à espera deste convite, podes ignorar este email — nenhuma conta será ativada sem que definas uma palavra-passe.",
    cta: "Definir Palavra-passe",
    footer: "GarageFlow — a plataforma de gestão para oficinas modernas.",
  },
  es: {
    subject: "Bienvenido a GarageFlow",
    preheader: "Define tu contraseña para empezar a usar GarageFlow.",
    greeting: (n) => `Hola ${n},`,
    intro:
      "Tu taller ha sido creado en <strong>GarageFlow</strong>. Para acceder a tu cuenta independiente, define ahora tu contraseña.",
    action: "Solo tienes que hacer clic en el botón — el enlace es seguro y temporal.",
    security:
      "Si no esperabas esta invitación, puedes ignorar este email — no se activará ninguna cuenta sin que definas una contraseña.",
    cta: "Definir Contraseña",
    footer: "GarageFlow — la plataforma de gestión para talleres modernos.",
  },
  fr: {
    subject: "Bienvenue sur GarageFlow",
    preheader: "Définissez votre mot de passe pour commencer à utiliser GarageFlow.",
    greeting: (n) => `Bonjour ${n},`,
    intro:
      "Votre atelier a été créé sur <strong>GarageFlow</strong>. Pour accéder à votre compte indépendant, définissez votre mot de passe.",
    action: "Il suffit de cliquer sur le bouton — le lien est sécurisé et temporaire.",
    security:
      "Si vous n'attendiez pas cette invitation, ignorez cet email — aucun compte ne sera activé sans mot de passe.",
    cta: "Définir le mot de passe",
    footer: "GarageFlow — la plateforme de gestion pour ateliers modernes.",
  },
  en: {
    subject: "Welcome to GarageFlow",
    preheader: "Set your password to start using GarageFlow.",
    greeting: (n) => `Hi ${n},`,
    intro:
      "Your workshop has been created on <strong>GarageFlow</strong>. To access your independent account, please set your password.",
    action: "Just click the button below — the link is secure and time-limited.",
    security:
      "If you were not expecting this invitation, you can safely ignore this email — no account is activated until you set a password.",
    cta: "Set Password",
    footer: "GarageFlow — the management platform for modern workshops.",
  },
};

export function buildChildInviteEmail(params: {
  recipientName: string;
  language?: string | null;
}): {
  subject: string;
  preheader: string;
  html: string;
  ctaLabel: string;
  footerNote: string;
} {
  const raw = (params.language || "pt").toLowerCase().slice(0, 2);
  const lang: InviteLang = (["pt", "es", "fr", "en"].includes(raw) ? raw : "pt") as InviteLang;
  const c = COPY[lang];
  const name = params.recipientName?.trim() || (lang === "en" ? "there" : "");

  const html = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${c.greeting(name)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${c.intro}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${c.action}</p>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${c.security}</p>
  `.trim();

  return {
    subject: c.subject,
    preheader: c.preheader,
    html,
    ctaLabel: c.cta,
    footerNote: c.footer,
  };
}
