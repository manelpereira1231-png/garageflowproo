# GarageFlow Demo as the real SaaS

## Goal
Make `/demo` and `/demo-demonstracao` run the real GarageFlow application against an isolated, preconfigured demo account. The only difference between the routes is an optional, discreet commercial guidance layer.

## Investigation
- Map the existing Demo routes/components and identify duplicated UI.
- Trace the real ERP router, authentication guards, active-shop context, and data loaders.
- Verify real detail routes and quote-notification navigation.
- Identify mutation and data-reset requirements so public demo usage cannot affect customer tenants or permanently corrupt the demo.

## Implementation direction
- Reuse the real `Layout`, pages, components, routes, filters, modals, and responsive behavior.
- Introduce one isolated demo runtime context that selects the demo tenant/data without changing normal customer behavior.
- Keep `/demo` autonomous and add only a lightweight commercial overlay to `/demo-demonstracao`.
- Preserve real entity relationships and real route behavior; do not create parallel Demo pages.
- Route the final autonomous CTA directly to `/auth?mode=signup`.

## Validation
- Compare real and demo modules visually on desktop and mobile.
- Exercise the required entity navigation chain and both notification entry points.
- Verify isolation from real tenants and predictable demo-state restoration.
- Report every unverified checklist item explicitly as `NÃO VALIDADO`.

## Technical notes
- Prefer route/context adapters over branches inside business pages.
- Avoid weakening authentication, RLS, or tenant isolation.
- If anonymous demo access cannot safely use the authenticated tenant directly, preserve real UI/components while providing a narrowly scoped, read-only demo data adapter matching existing page contracts.
