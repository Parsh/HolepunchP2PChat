module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Disable problematic prettier rules for this PoC
    'prettier/prettier': 'off',
    // Allow longer lines
    'max-len': 'off',
    // Allow console statements
    'no-console': 'off',
  },
};
