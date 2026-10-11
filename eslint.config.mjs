import { createRequire } from "node:module";

// CJS paketleri `import` default ile ÇEKME (bilinçli): `__esModule` +
// iç `default` taşıyan paketlerde default-import yorumu Node sürümüne göre
// değişir (lokal Node 26 tam objeyi, CI'daki Node 22 iç `.default`'u
// çözdü → crash). `require()` CJS semantiği her sürümde deterministiktir.
const require = createRequire(import.meta.url);

// v16-native flat array'ler: `eslint-config-next@16` artık doğrudan flat
// config blokları export eder (core-web-vitals.js =
// [...index.default, plugin.configs['core-web-vitals']]).
// `@next/eslint-plugin-next` paketinde `flatConfig` exportu YOKTUR (v16'da
// kaldırıldı) — o paketten kural okumaya çalışmak
// `TypeError: Cannot read properties of undefined` ile patlar.
const nextVitals = require("eslint-config-next/core-web-vitals");
const nextTs = require("eslint-config-next/typescript");

// FlatCompat KULLANILMAZ (bilinçli): `compat.extends("next/...")` kalıbı
// `@rushstack/eslint-patch`'in kırılgan caller-tespit zincirine girer ve
// ortamdan ortama "Converting circular structure to JSON" ile patlar
// (CI'da görüldü).
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      ".worktrees/**",
      ".superpowers/**",
      // Bağımsız mockup projeleri (kendi eslint/tsconfig'leriyle) — bkz. tsconfig.json.
      "designs/**",
    ],
  },
  // nextVitals: "next" bloğu (parser + globals + tüm plugin/kurallar,
  // js/jsx/mjs/ts/tsx/mts/cts kapsamlı) + "next/typescript" TS parser bloğu
  // (*.ts/*.tsx — TS dosyaları espree ile parse edilemez, bu blok şart) +
  // core-web-vitals kuralları. `.next/out/build/next-env.d.ts` ignore'ları
  // bu array'lerin içinden gelir.
  ...nextVitals,
  // nextTs: typescript-eslint base + eslint-recommended + recommended +
  // 2 warn override (no-unused-vars, no-unused-expressions) + ignore'lar.
  ...nextTs,
  // react-hooks v6'nın iki yeni katı kuralı (set-state-in-effect, refs):
  // main ağacındaki 4 dosyada pre-existing pattern'leri error olarak
  // işaretler (eski config de aynı plugin sürümünde error verirdi — crash
  // öncesi lint'e hiç ulaşılamıyordu). Davranış değişikliği riskine karşı
  // kaynak dosyaları refactor ETME; warn'a indir (CI: warning serbest,
  // error yasak). Görünürlük korunur, `npm run check` yeşil kalır.
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default eslintConfig;
