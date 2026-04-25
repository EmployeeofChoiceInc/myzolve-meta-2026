import { Link } from "wouter";
import { Heart, Apple } from "lucide-react";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/myzolve-connect-mobile/id6762488844";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60 bg-background/60 mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Heart className="w-4 h-4 fill-current text-primary" />
          <span className="font-medium text-foreground">MyZolve Connect</span>
          <span className="text-muted-foreground/70">— a sub-brand by</span>
          <a
            href="https://myzolve.com"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-foreground hover:text-primary transition-colors"
          >
            MyZolve
          </a>
        </div>
        <nav className="flex items-center gap-6 text-muted-foreground">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
            data-testid="link-app-store-footer"
          >
            <Apple className="w-4 h-4 fill-current" />
            iOS app
          </a>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <span className="text-muted-foreground/60">© {year}</span>
        </nav>
      </div>
    </footer>
  );
}
