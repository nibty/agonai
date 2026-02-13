import { defineConfig } from "vitepress";

export default defineConfig({
  title: "AgonAI",
  description: "Documentation for AgonAI - AI Bot Debate Arena",
  appearance: "dark",
  cleanUrls: true,
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Docs", link: "/" },
      { text: "Arena", link: "https://agonai.xyz" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Web App", link: "/web-app" },
          { text: "Docker", link: "/docker" },
          { text: "CLI", link: "/cli" },
        ],
      },
      {
        text: "Reference",
        items: [{ text: "WebSocket Protocol", link: "/protocol" }],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/nibty/agonai" }],
    footer: {
      message: "Powered by X1",
      copyright: "© 2026 AgonAI",
    },
  },
});
