import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'out/**',
      'dist/**',
      'node_modules/**',
      '*.config.*',
      'coverage/**',
      '.stryker-tmp/**',
      'reports/**',
      'release/**'
    ]
  },
  {
    files: ['electron/**/*.ts', 'src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    // `scripts/*.mjs` não era coberto por nenhum bloco com `files`, então o
    // eslint os visitava sem regra nenhuma — na prática, só parse. Não há
    // typecheck nem teste para `.mjs` tampouco, e foi por essa fresta que o
    // `smoke-visual.mjs` chegou quebrado à `main` e a uma tag publicada.
    //
    // Isto não fecha aquele buraco, e vale ser exato: o que quebrou lá foi um
    // campo de IPC renomeado dentro de um `page.evaluate`, que roda no contexto
    // do renderer. Nenhuma regra de lint enxerga isso. O que este bloco pega é
    // a classe mais banal — variável indefinida, import não usado, sintaxe — que
    // hoje passa inteira.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Declarados na mão em vez de puxar o pacote `globals`, que só existe
      // aqui como dependência transitiva do próprio eslint. São exatamente os
      // que os dois scripts usam — a lista curta é proposital: qualquer global
      // novo aparece como erro, e aí se decide se cabe.
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        // `document` e `window` aparecem dentro dos callbacks de
        // `page.evaluate`, que o Playwright executa no contexto do renderer —
        // são legítimos ali. Declará-los é melhor que desligar `no-undef`:
        // a regra continua pegando identificador errado no código Node.
        document: 'readonly',
        window: 'readonly'
      }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    // Testes E2E (Playwright): regras TS, sem os plugins React. O callback `use`
    // dos fixtures do Playwright não é um React Hook — react-hooks daria falso positivo.
    files: ['e2e/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
]
