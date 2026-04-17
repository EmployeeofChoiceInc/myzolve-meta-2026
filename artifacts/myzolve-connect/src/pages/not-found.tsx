import { Link } from "wouter";
import { Heart, Home, ArrowLeft, Compass } from "lucide-react";
import { Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/site-footer";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center justify-between p-6 lg:px-12">
        <Link href="/" className="flex items-center gap-2 text-primary font-semibold text-xl">
          <Heart className="w-7 h-7 fill-current" />
          MyZolve Connect
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 text-primary mb-8">
          <Compass className="w-10 h-10" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary mb-3">
          404 — page not found
        </p>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground max-w-2xl mb-4">
          We couldn't find that page.
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mb-10 leading-relaxed">
          The link may have moved, or it may never have existed. Let's get you
          back to somewhere familiar.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Show when="signed-in">
            <Link href="/dashboard">
              <Button size="lg" className="rounded-full px-6 h-12">
                <Home className="w-4 h-4 mr-2" /> Back to dashboard
              </Button>
            </Link>
          </Show>
          <Show when="signed-out">
            <Link href="/">
              <Button size="lg" className="rounded-full px-6 h-12">
                <Home className="w-4 h-4 mr-2" /> Back home
              </Button>
            </Link>
          </Show>
          <Button
            variant="ghost"
            size="lg"
            className="rounded-full px-6 h-12"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Go back
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
