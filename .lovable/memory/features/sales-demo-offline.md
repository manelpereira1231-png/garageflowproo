---
name: Demo uses the real SaaS
 description: /demo and /demo-demonstracao must run the real GarageFlow app with an isolated temporary demo tenant
 type: feature
---
`/demo` and `/demo-demonstracao` must use the real GarageFlow `Layout`, router, pages, components, validations and ERP data model against an isolated temporary Demo tenant named AutoPrime Lisboa.
- `/demo` is autonomous and contains no seller scripts or internal commercial notes.
- `/demo-demonstracao` is the same application and tenant with only a discreet commercial guidance overlay.
- Do not rebuild, imitate or duplicate real ERP screens for Demo.
- Demo data must use real relational structures and be isolated from customer tenants.
- Irreversible external side effects must be blocked for Demo tenants.
- Quote notifications must open the specific real quote detail by `quote_id`.
