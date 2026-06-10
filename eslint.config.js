import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Frontière d'architecture : supabase-js uniquement dans src/realtime (PLAN.md §2)
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Importer via src/realtime uniquement (frontière PLAN.md §2).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/realtime/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
)
