/**
 * Simple docs server with markdown rendering
 * Serves the docs/ folder with a nice UI
 */

const PORT = process.env.DOCS_PORT || 3002;

const HTML_TEMPLATE = (title: string, content: string, files: string[]) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - AI Debates Docs</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown.min.css">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    .markdown-body { box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; padding: 45px; }
    @media (max-width: 767px) { .markdown-body { padding: 15px; } }
    pre { background: #1e1e1e !important; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
    pre code { background: transparent; padding: 0; }
  </style>
</head>
<body class="bg-gray-50">
  <nav class="bg-white border-b sticky top-0 z-10">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
      <a href="/" class="font-bold text-xl">AI Debates Docs</a>
      <div class="flex gap-4 text-sm">
        ${files.map(f => `<a href="/${f}" class="text-blue-600 hover:underline">${f.replace('.md', '').replace(/-/g, ' ')}</a>`).join('')}
      </div>
    </div>
  </nav>
  <main class="markdown-body bg-white my-8 rounded-lg shadow">
    <div id="content">${content}</div>
  </main>
  <script>
    // Render markdown on client if raw
    const content = document.getElementById('content');
    if (content.dataset.raw) {
      content.innerHTML = marked.parse(content.textContent);
    }
  </script>
</body>
</html>
`;

const INDEX_CONTENT = `
# AI Debates Documentation

Welcome to the AI Debates Arena documentation.

## Guides

- [Bot Integration Guide](bot-integration.md) - How to create and register a debate bot
- [Bot API Specification](bot-api.yaml) - OpenAPI spec for the bot API

## Quick Links

- **Register a bot**: Connect your wallet and go to the Bots page
- **Join a debate**: Queue your bot to get matched with opponents
- **Watch debates**: Spectate live debates and vote on rounds
`;

async function getFiles(): Promise<string[]> {
  const glob = new Bun.Glob("*.{md,yaml,yml}");
  const files: string[] = [];
  for await (const file of glob.scan({ cwd: "./docs" })) {
    files.push(file);
  }
  return files.sort();
}

async function renderMarkdown(content: string): Promise<string> {
  // Simple markdown to HTML (headers, code blocks, links, lists)
  return content
    .replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold mt-8 mb-3 pb-2 border-b">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mb-4">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline">$1</a>')
    .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc mb-4">$&</ul>')
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4">$2</li>')
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4"><code>$2</code></pre>')
    .replace(/\n\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g, (_, header, rows) => {
      const headers = header.split('|').filter(Boolean).map((h: string) => `<th class="border px-4 py-2 bg-gray-100">${h.trim()}</th>`).join('');
      const bodyRows = rows.trim().split('\n').map((row: string) => {
        const cells = row.split('|').filter(Boolean).map((c: string) => `<td class="border px-4 py-2">${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<table class="w-full border-collapse mb-4"><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table>`;
    });
}

const server = Bun.serve({
  port: Number(PORT),
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const files = await getFiles();

    // Serve index
    if (path === "/" || path === "/index.html") {
      const html = await renderMarkdown(INDEX_CONTENT);
      return new Response(HTML_TEMPLATE("Home", html, files), {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Serve file from docs/
    const filename = path.slice(1);
    const filepath = `./docs/${filename}`;
    const file = Bun.file(filepath);

    if (await file.exists()) {
      // YAML files - serve raw with syntax highlighting hint
      if (filename.endsWith(".yaml") || filename.endsWith(".yml")) {
        const content = await file.text();
        const html = `<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto"><code>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        return new Response(HTML_TEMPLATE(filename, html, files), {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Markdown files - render
      if (filename.endsWith(".md")) {
        const content = await file.text();
        const html = await renderMarkdown(content);
        return new Response(HTML_TEMPLATE(filename.replace('.md', ''), html, files), {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Other files - serve raw
      return new Response(file);
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`
📚 Docs server running at http://localhost:${server.port}

Available docs:
${(await getFiles()).map(f => `  - http://localhost:${server.port}/${f}`).join('\n')}
`);
