import prettier from 'prettier';

class Formatter {
  constructor({ filePath, ignorePath }) {
    this.filePath = filePath;
    this.ignorePath = ignorePath || '.prettierignore';

    this.info = prettier.getFileInfo(filePath, { ignorePath });
    this.config = prettier.resolveConfig(filePath);
  }

  async format(content) {
    const { filePath } = this;

    const [config, { ignored, inferredParser }] = await Promise.all([
      this.config,
      this.info,
    ]);

    if (ignored) return content;

    if (!inferredParser) return content;

    return prettier.format(content, { filepath: filePath, ...config });
  }

  async canParse() {
    return !!(await this.info).inferredParser;
  }
}

export default Formatter;
