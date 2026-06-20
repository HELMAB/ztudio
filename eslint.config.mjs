// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import eslintConfigPrettier from 'eslint-config-prettier'

export default withNuxt({
  // shadcn-vue ships these generated components; keep them as-is.
  ignores: ['app/components/ui/**'],
}).append(eslintConfigPrettier)
