import { useState } from "react";
import { Copy, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg bg-arena-bg p-4 text-sm">
        <code className="text-arena-text-muted">{children.trim()}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 rounded p-1.5 text-arena-text-dim opacity-0 transition-opacity hover:bg-arena-border/50 hover:text-arena-text group-hover:opacity-100"
        aria-label="Copy code"
      >
        {copied ? <Check className="h-4 w-4 text-arena-pro" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Section({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-arena-accent/20 text-arena-accent">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-arena-text">{title}</h2>
      </div>
      <div className="space-y-4 text-arena-text-muted">{children}</div>
    </section>
  );
}

export function NavCard({
  href,
  icon,
  title,
  description,
  isLink = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  isLink?: boolean;
}) {
  const className =
    "group flex items-center gap-4 rounded-lg border border-arena-border bg-arena-card p-4 transition-colors hover:border-arena-accent/50 hover:bg-arena-card/80";

  const content = (
    <>
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-arena-accent/10 text-arena-accent">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-arena-text">{title}</h3>
        <p className="text-sm text-arena-text-dim">{description}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-arena-text-dim transition-transform group-hover:translate-x-1 group-hover:text-arena-accent" />
    </>
  );

  if (isLink) {
    return (
      <Link to={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href} className={className}>
      {content}
    </a>
  );
}

export function PageHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <Link
        to="/docs"
        className="mb-4 inline-flex items-center gap-2 text-sm text-arena-text-muted hover:text-arena-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Docs
      </Link>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-arena-accent/20">
          {icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-arena-text">{title}</h1>
          <p className="text-arena-text-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}
