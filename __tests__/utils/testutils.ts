/* eslint-disable import/no-import-module-exports */
import fs from 'fs';
import path from 'path';

const writeFile = (file: unknown, filePath: string) => {
  const pathDir = path.dirname(filePath);
  if (!fs.existsSync(pathDir)) {
    fs.mkdirSync(pathDir);
  }

  fs.writeFileSync(filePath, JSON.stringify(file));
};

export {
  // eslint-disable-next-line import/prefer-default-export
  writeFile,
};
