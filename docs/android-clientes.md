# GarageFlow Clientes — build Android

Pasta nativa: `android-clientes/` (separada da app das oficinas, que usaria `android/`).

Rebuild numa cópia (para não trocar a configuração das oficinas):
1. `npm install && npm run build`
2. Numa cópia do projeto: `cp capacitor.clientes.config.ts capacitor.config.ts && npx cap sync android`
3. `cd android-clientes && ./gradlew bundleRelease` (com `keystore.properties` local, ver `keystore.properties.example`; nunca enviar a chave para o GitHub).

Linux: exportar `LC_ALL=C.UTF-8` (há páginas com acentos no nome).
