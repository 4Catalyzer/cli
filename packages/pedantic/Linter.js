const { CLIEngine } = require('eslint');

const formatter = CLIEngine.getFormatter();

class Linter {
  constructor({ cwd, fix }) {
    this.cwd = cwd;
    this.fix = fix;

    this.cli = new CLIEngine({ cwd, fix });
    this.results = [];
    this.errorCount = 0;
    this.warningCount = 0;
  }

  get hasChanges() {
    return !!(this.errorCount || this.warningCount);
  }

  check(content, filePath) {
    if (
      !filePath.endsWith('.js') &&
      !filePath.endsWith('.ts') &&
      !filePath.endsWith('.tsx')
    ) {
      return content;
    }
    const { results } = this.cli.executeOnText(content, filePath);
    if (!results.length) return content;

    const [result] = results;

    // filter out fixed errors
    if (this.fix && (result.fixableErrorCount || result.fixableWarningCount)) {
      result.errorCount -= result.fixableErrorCount;
      result.WarningCount -= result.fixableWarningCount;
      result.messages = result.messages.filter((msg) => msg.fix);
    }

    this.errorCount += result.errorCount;
    this.warningCount += result.warningCount;

    this.results.push(result);

    return result.output || content;
  }

  output() {
    return formatter(this.results);
  }
}

module.exports = Linter;
