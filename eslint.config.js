import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', '.pi']),
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ['bookmarklet/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,
        SNAPSHOT_KIND: 'readonly',
        SNAPSHOT_VERSION: 'readonly',
        HANDOFF_HELLO: 'readonly',
        HANDOFF_READY: 'readonly',
        RESURFACE_ORIGIN: 'readonly',
      },
    },
  },
  {
    files: ['*.js'],
    languageOptions: { globals: globals.node },
  },
])
