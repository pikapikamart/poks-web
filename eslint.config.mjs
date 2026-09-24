import parser from "@typescript-eslint/parser";
import typescript from "@typescript-eslint/eslint-plugin";

const isFunctionVariable = (node) =>
  node.type === "VariableDeclaration" &&
  node.declarations.some(
    (declaration) =>
      declaration.init?.type === "ArrowFunctionExpression" ||
      declaration.init?.type === "FunctionExpression",
  );

const paddedHooks = new Set([
  "useCallback",
  "useEffect",
  "useLayoutEffect",
  "useMemo",
]);

const isPaddedHookCall = (node) => {
  const call =
    node.type === "VariableDeclaration"
      ? node.declarations[0]?.init
      : node.type === "ExpressionStatement"
        ? node.expression
        : null;

  return (
    call?.type === "CallExpression" &&
    call.callee.type === "Identifier" &&
    paddedHooks.has(call.callee.name)
  );
};

const functionPaddingRule = {
  meta: {
    type: "layout",
    fixable: "whitespace",
    schema: [],
    messages: {
      missingPadding: "Expected a blank line around this function declaration.",
    },
  },
  create: (context) => {
    const reported = new Set();

    const requirePadding = (previous, next) => {
      if (
        !previous ||
        !next ||
        next.loc.start.line - previous.loc.end.line >= 2
      ) {
        return;
      }

      const key = next.range?.[0] ?? next.loc.start.line;

      if (reported.has(key)) {
        return;
      }

      reported.add(key);

      context.report({
        node: next,
        messageId: "missingPadding",
        fix: (fixer) => fixer.insertTextBefore(next, "\n"),
      });
    };

    const verify = (node) => {
      if (
        node.type !== "FunctionDeclaration" &&
        !isFunctionVariable(node) &&
        !isPaddedHookCall(node)
      ) {
        return;
      }

      const statement =
        node.parent.type === "ExportNamedDeclaration" ? node.parent : node;
      const parent = statement.parent;
      const statements =
        parent.type === "Program" || parent.type === "BlockStatement"
          ? parent.body
          : parent.type === "SwitchCase"
            ? parent.consequent
            : null;

      if (!statements) {
        return;
      }

      const index = statements.indexOf(statement);

      if (index === -1) {
        return;
      }

      requirePadding(statements[index - 1], statement);
      requirePadding(statement, statements[index + 1]);
    };

    return {
      ExpressionStatement: verify,
      FunctionDeclaration: verify,
      VariableDeclaration: verify,
    };
  },
};

export default [
  { ignores: [".next/**", ".trigger/**", "node_modules/**", "next-env.d.ts"] },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: { sourceType: "module", ecmaVersion: "latest" },
    },
    plugins: {
      "@typescript-eslint": typescript,
      local: { rules: { "function-padding": functionPaddingRule } },
    },
    rules: {
      ...typescript.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "func-style": ["error", "expression", { allowArrowFunctions: true }],
      curly: ["error", "all"],
      indent: ["error", 2, { SwitchCase: 1 }],
      "no-trailing-spaces": "error",
      "one-var": ["error", "never"],
      "local/function-padding": "error",
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: "block-like" },
        { blankLine: "always", prev: "block-like", next: "*" },
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "never", prev: "import", next: "import" },
      ],
      "padded-blocks": ["error", "never"],
    },
  },
];
