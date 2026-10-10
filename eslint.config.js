import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// Flat-config port of the former .eslintrc.cjs. ESLint 9 no longer reads the
// legacy format, which left `pnpm lint` failing before checking any file.
export default tseslint.config(
  // Generated output: `prisma generate` writes worker/generated (gitignored),
  // `wrangler types` writes worker-configuration.d.ts.
  { ignores: ['dist', 'worker/generated', 'worker-configuration.d.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)
