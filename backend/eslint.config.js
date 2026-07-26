// @ts-check
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // ── Ignored paths ──────────────────────────────────────────────────────────
  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  // ── TypeScript recommended rules ──────────────────────────────────────────
  ...tseslint.configs.recommended,

  // ── Project-specific rules ─────────────────────────────────────────────────
  {
    rules: {
      // Warn on unused vars but allow underscore-prefixed to be ignored
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Warn on any — useful to catch untyped code
      '@typescript-eslint/no-explicit-any': 'warn',

      // Enforce `import type` for type-only imports (reduces runtime bundle)
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // Disallow non-null assertions (use proper checks instead)
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // ── Disable Prettier-conflicting rules (must be last) ─────────────────────
  eslintConfigPrettier,
);
