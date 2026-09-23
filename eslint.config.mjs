import parser from "@typescript-eslint/parser";
import typescript from "@typescript-eslint/eslint-plugin";
export default [
  { ignores: [".next/**", ".trigger/**", "node_modules/**", "next-env.d.ts"] },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: { sourceType: "module", ecmaVersion: "latest" },
    },
    plugins: { "@typescript-eslint": typescript },
    rules: {
      ...typescript.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
];
