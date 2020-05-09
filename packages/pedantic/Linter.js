const { ESLint } = require('eslint');

class Linter {
  #eslint;

  #results;

  constructor({ cwd, fix }) {
    this.fix = fix;

    this.#eslint = new ESLint({ cwd, fix });
    this.#results = [];

    this.errorCount = 0;
    this.warningCount = 0;
  }

  get hasChanges() {
    return !!(this.errorCount || this.warningCount);
  }

  async check(content, filePath) {
    if (
      !filePath.endsWith('.js') &&
      !filePath.endsWith('.ts') &&
      !filePath.endsWith('.tsx')
    ) {
      return content;
    }
    const results = await this.#eslint.lintText(content, { filePath });
    if (!results.length) return content;

    const [result] = results;

    // Filter out fixed errors.
    if (this.fix && (result.fixableErrorCount || result.fixableWarningCount)) {
      result.errorCount -= result.fixableErrorCount;
      result.warningCount -= result.fixableWarningCount;
      result.messages = result.messages.filter((msg) => msg.fix);
    }

    this.errorCount += result.errorCount;
    this.warningCount += result.warningCount;

    this.#results.push(result);

    return result.output || content;
  }

  async output() {
    const formatter = await this.#eslint.loadFormatter();
    return formatter.format(this.#results);
  }
}

module.exports = Linter;
