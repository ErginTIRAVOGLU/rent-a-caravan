import { createRequire } from "node:module";

// CJS plugin'leri `import` default ile ÇEKME (bilinçli): `__esModule` +
// iç `default` taşıyan paketlerde default-import yorumu Node sürümüne göre
// değişir (lokal Node 26 tam objeyi, CI'daki Node 22 iç `.default`'u
// çözdü → `flatConfig` undefined crash'i). `require()` CJS semantiği her
// sürümde deterministiktir.
const require = createRequire(import.meta.url);
const nextPlugin = require("@next/eslint-plugin-next");
const reactHooks = require("eslint-plugin-react-hooks");
const jsxA11y = require("eslint-plugin-jsx-a11y");
const importPlugin = require("eslint-plugin-import");
const reactPlugin = require("eslint-plugin-react");
const tseslint = require("typescript-eslint");
const globals = require("globals");

// FlatCompat KULLANILMAZ (bilinçli): `compat.extends("next/...")` kalıbı
// `@rushstack/eslint-patch`'in kırılgan caller-tespit zincirine girer ve
// ortamdan ortama "Converting circular structure to JSON" ile patlar
// (CI'da görüldü). Aşağıdaki bloklar legacy `eslint-config-next` içeriğinin
// birebir karşılığıdır — kural kaybı yok:
//   base index.js → sharedRules (hooks + a11y + import + react off'ları)
//   plugin:@next/next/core-web-vitals → nextCoreWebVitalsRules
//   next/typescript → tseslint recommended + 2 warn override

const sharedPlugins = {
  "@next/next": nextPlugin,
  "react-hooks": reactHooks,
  "jsx-a11y": jsxA11y,
  react: reactPlugin,
  import: importPlugin,
};

// Legacy base index.js rules bölümüyle birebir (sıra önemsiz, değerler aynı).
const sharedRules = {
  ...reactHooks.configs.recommended.rules,
  "import/no-anonymous-default-export": "warn",
  "react/no-unknown-property": "off",
  "react/react-in-jsx-scope": "off",
  "react/prop-types": "off",
  "jsx-a11y/alt-text": ["warn", { elements: ["img"], img: ["Image"] }],
  "jsx-a11y/aria-props": "warn",
  "jsx-a11y/aria-proptypes": "warn",
  "jsx-a11y/aria-unsupported-elements": "warn",
  "jsx-a11y/role-has-required-aria-props": "warn",
  "jsx-a11y/role-supports-aria-props": "warn",
  "react/jsx-no-target-blank": "off",
  ...nextPlugin.flatConfig.coreWebVitals.rules,
};

const sharedSettings = {
  react: { version: "detect" },
};

const sharedLanguageOptions = {
  globals: { ...globals.browser, ...globals.node },
};

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      ".worktrees/**",
      ".superpowers/**",
      // Bağımsız mockup projeleri (kendi eslint/tsconfig'leriyle) — bkz. tsconfig.json.
      "designs/**",
      // next build/dev bu dosyayı her seferinde yeniden üretir; triple-slash
      // referansları eslint kuralını tetikler → kalıcı olarak yok say.
      "next-env.d.ts",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    plugins: sharedPlugins,
    rules: sharedRules,
    settings: sharedSettings,
    languageOptions: sharedLanguageOptions,
  },
  // TypeScript: tseslint recommended (parser + kurallar, kendi files
  // kapsamıyla gelir) + next/typescript'in 2 warn override'ı.
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    plugins: {
      ...sharedPlugins,
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...sharedRules,
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
    },
    settings: sharedSettings,
    languageOptions: sharedLanguageOptions,
  },
];

export default eslintConfig;
