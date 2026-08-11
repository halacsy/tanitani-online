import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // The font stylesheets are intentionally mounted once in the root App
    // Router layout, which is equivalent to a global document-level include.
    rules: { '@next/next/no-page-custom-font': 'off' },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'public/admin/**',
    'public/sites/**',
    'content/migrated/**',
  ]),
])
