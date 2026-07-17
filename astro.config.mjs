import { defineConfig } from "astro/config";

const base = process.env.PUBLIC_BASE_PATH || "/";
const site = process.env.PUBLIC_SITE_URL;

export default defineConfig({
  output: "static",
  base,
  ...(site ? { site } : {})
});
