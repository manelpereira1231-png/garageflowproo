---
name: SAF-T Certification Architecture
description: Arquitetura modular do SAF-T PT preparada para certificação AT futura (config no admin, sem alterar código)
type: feature
---

Toda a configuração legal do SAF-T é data-driven, nunca hardcoded:

- `saft_certification_settings` (singleton, só Super Admin): is_certified, software_certificate_number, product_id/version, produtor (nome + NIF), saft_version, tax_accounting_basis, signing_enabled, signing_key_secret_name, signing_key_version, header_comment_override.
- `document_series` (por oficina): doc_type, series_code, at_validation_code (base do ATCUD), initial_sequence, is_active.
- `document_signatures`: cadeia imutável de hashes (source_string, previous_hash, hash, hash_control, atcud, algorithm). Escrita apenas por service_role; assinatura nunca é recalculada.

Código: `supabase/functions/_shared/saftCertification.ts` é a única camada legal (loadCertificationConfig, loadSeries, loadSigningKey, signDocument, buildAtcud, buildHeaderComment, certificateNumberField). `export-saft/index.ts` contém apenas lógica técnica de XML.

Regras:
- Sem certificado/série/assinatura → campos saem `0` e o HeaderComment lista explicitamente o que falta. NUNCA usar valores fictícios nem esconder o aviso.
- Chave privada RSA (PKCS#8 PEM) vive num secret (default `SAFT_SIGNING_PRIVATE_KEY`), nunca na BD. Assinatura RSA-SHA1 conforme Portaria 363/2010: `DataDoc;DataHoraSistema;NumDoc;TotalIliquido;HashAnterior`.
- Ativação futura = preencher /admin/saft-certification + guardar secret. Sem deploy nem refactor.
