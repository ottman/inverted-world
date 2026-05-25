import nextCoreWebVitals from "eslint-config-next/core-web-vitals"

const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "import/no-anonymous-default-export": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: [".expo/**", "data/generated/**", "dist/**", "node_modules/**"],
  },
]

export default config
