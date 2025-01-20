const OUTPUT_DIR =
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- if the first value is '' nullish coalescing will return '' so leaving || for safty
  process.env.WORKING_DIRECTORY || './__tests__/integration/results';

export default {
  OUTPUT_DIR,

  OUTPUT_FILE_DB: `${OUTPUT_DIR}/mockDb.json`,
};
