import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  rules: {
    'unused-imports/no-unused-vars': 'off',
    'no-console': 'off',
    'unicorn/switch-case-braces': 'error',
    'style/brace-style': 'off',
    'test/prefer-lowercase-title': 'off',
  },
  ignores: ['dist', '*.md'],
})
