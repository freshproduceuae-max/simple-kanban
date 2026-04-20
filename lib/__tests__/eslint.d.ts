/**
 * Minimal type shim for `eslint` (the npm package ships JS without bundled
 * types, and we intentionally avoid adding `@types/eslint` as a dependency
 * just for one test). Only the surface we actually use is declared.
 */
declare module 'eslint' {
  namespace Linter {
    interface LintMessage {
      ruleId: string | null;
      severity: 0 | 1 | 2;
      message: string;
      line?: number;
      column?: number;
    }
  }

  interface LintResult {
    filePath: string;
    messages: Linter.LintMessage[];
    errorCount: number;
    warningCount: number;
  }

  interface LintTextOptions {
    filePath?: string;
    warnIgnored?: boolean;
  }

  class ESLint {
    constructor(options?: { cwd?: string; overrideConfigFile?: string });
    lintText(code: string, options?: LintTextOptions): Promise<LintResult[]>;
  }
}
