﻿module.exports = {
  presets: [
    ["@babel/preset-env", {targets: {node: "current"}}],
    "@babel/preset-typescript",
  ],
  plugins: [
    "@babel/plugin-transform-runtime",
    [
      "module-resolver",
      {
        root: ["./"],
        alias: {
          "@database": "./lib/src/database",
          "@utils": "./lib/src/utils",
        },
      },
    ],
  ],
};
