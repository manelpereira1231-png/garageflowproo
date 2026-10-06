# Architecture rules

- Claims v2 reuses the existing claims tables and tools; keep legacy fields available under optional details to preserve existing records.
- Claims visual tokens are scoped to `.claims-surface` to avoid changing ERP or Market pages.
- Claim document access uses signed URLs from the existing private bucket; expert links expose only the initial damage set or photographs explicitly associated with their authorization.
- Derive claim phases from authoritative records without rewriting legacy states merely by opening a page, to avoid unintended data changes.
- Claim expert packages reuse the existing quote PDF and email service, recording sent communications only after confirmed delivery submission.
- Claims use progressive disclosure with a phase-based next action; expert delivery requires an explicit preview and channel choice, and vehicle identity comes from the claim's linked vehicle.
- Claims list actions reuse the existing quote/service routes with claim, client and vehicle context; insurer actions first select or create a claim to avoid documents without a vehicle.
