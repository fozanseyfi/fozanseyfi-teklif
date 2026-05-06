import Link from "next/link";
import { Globe, Mail } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14ZM8.5 18V10H6v8h2.5Zm-1.25-9.1c.83 0 1.5-.67 1.5-1.5S8.08 5.9 7.25 5.9 5.75 6.57 5.75 7.4s.67 1.5 1.5 1.5ZM18 18v-4.6c0-2.16-1.16-3.16-2.7-3.16-1.25 0-1.81.69-2.13 1.18V10H10.7c.03.71 0 8 0 8h2.47v-4.47c0-.22.02-.44.08-.6.18-.44.59-.9 1.27-.9.9 0 1.26.69 1.26 1.7V18H18Z" />
    </svg>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  const { developer, name } = siteConfig;

  return (
    <footer className="mt-12 border-t bg-background/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-1.5">
          <span>© {year}</span>
          <span className="font-medium text-foreground">{name}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>
            Tasarım &amp; Geliştirme:{" "}
            <Link
              href={developer.website.href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground hover:text-primary"
            >
              {developer.name}
            </Link>
          </span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Link
            href={developer.linkedin.href}
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
            className="transition-colors hover:text-primary"
          >
            <LinkedInIcon className="size-4" />
          </Link>
          <Link
            href={developer.website.href}
            target="_blank"
            rel="noreferrer"
            aria-label="Web sitesi"
            className="transition-colors hover:text-primary"
          >
            <Globe className="size-4" />
          </Link>
          <Link
            href={`mailto:${developer.email}`}
            aria-label="E-posta"
            className="transition-colors hover:text-primary"
          >
            <Mail className="size-4" />
          </Link>
        </div>
      </div>
    </footer>
  );
}

export { LinkedInIcon };
