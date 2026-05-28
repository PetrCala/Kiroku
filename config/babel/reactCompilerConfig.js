// Single source of truth for the babel-plugin-react-compiler options.
// Consumed by babel.config.js (metro + webpack pipelines) and by
// scripts/react-compiler-compliance-check.ts (noEmit compliance pass).
const ReactCompilerConfig = {
  target: '19',
  environment: {
    enableTreatRefLikeIdentifiersAsRefs: true,
  },
  sources: filename =>
    !filename.includes('tests/') && !filename.includes('node_modules/'),
};

module.exports = ReactCompilerConfig;
