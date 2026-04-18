-- India
UPDATE country_settings SET
  stripe_pro_monthly = 'price_1TNMT7KIsGuKgNEHBxfZqIRz',
  stripe_pro_yearly = 'price_1TNMTLKIsGuKgNEH2wIzzlKg',
  stripe_garage_monthly = 'price_1TNMU0KIsGuKgNEHApHH54av',
  stripe_garage_yearly = 'price_1TNMV1KIsGuKgNEHzicpV1m7'
WHERE code = 'IN';

-- US
UPDATE country_settings SET
  stripe_pro_monthly = 'price_1TNMViKIsGuKgNEHyp3YuPn2',
  stripe_pro_yearly = 'price_1TNMVzKIsGuKgNEHZp5YfYrw',
  stripe_garage_monthly = 'price_1TNMWEKIsGuKgNEHBBml0f4D',
  stripe_garage_yearly = 'price_1TNMWTKIsGuKgNEHFxoyDZUm'
WHERE code = 'US';

-- UK
UPDATE country_settings SET
  stripe_pro_monthly = 'price_1TNMWuKIsGuKgNEHKEoMRuv4',
  stripe_pro_yearly = 'price_1TNMXkKIsGuKgNEHDIiaMJAM',
  stripe_garage_monthly = 'price_1TNMYYKIsGuKgNEHGyLhpbnj',
  stripe_garage_yearly = 'price_1TNMZ2KIsGuKgNEHde2V41Hx'
WHERE code = 'UK';

-- DE / ES / FR partilham preços EUR com PT
UPDATE country_settings SET
  stripe_pro_monthly = 'price_1T4YARE1zL2Sl1ZT0iAS9Cmk',
  stripe_pro_yearly = 'price_1T49EZE1zL2Sl1ZTHGB40FiB',
  stripe_garage_monthly = 'price_1T4YAeE1zL2Sl1ZTrqc35wZy',
  stripe_garage_yearly = 'price_1T49EnE1zL2Sl1ZTs0crtbLM'
WHERE code IN ('DE', 'ES', 'FR');