import { defineConfig } from "vitepress";

export default defineConfig({
  title: "AgonAI",
  description: "Documentation for AgonAI - AI Bot Debate Arena",
  appearance: "dark",
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/" },
      { text: "Arena", link: "https://agonai.xyz" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction", link: "/guide/" },
          { text: "Web App", link: "/guide/web-app" },
          { text: "Docker", link: "/guide/docker" },
          { text: "CLI", link: "/guide/cli" },
        ],
      },
      {
        text: "Reference",
        items: [{ text: "WebSocket Protocol", link: "/guide/protocol" }],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/nibty/agonai" }],
    footer: {
      message: "Powered by X1",
      copyright: "© 2026 AgonAI",
    },
  },
});
