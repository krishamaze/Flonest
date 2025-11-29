import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        globals: globals.browser,
        parser: tsParser,
    },
    plugins: {
        "@typescript-eslint": tsPlugin,
        react: reactPlugin,
        "react-hooks": reactHooksPlugin,
    },
    rules: {
        "no-unused-vars": "warn",
        "react/react-in-jsx-scope": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
        "@typescript-eslint/explicit-function-return-type": "off",
    },
    settings: {
        react: {
            version: "detect",
        },
    },
};
