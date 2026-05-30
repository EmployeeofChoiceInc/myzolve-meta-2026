import { Link } from "wouter";
import { Heart, Users, Shield, ArrowRight, Sparkles, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/site-footer";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/myzolve-connect-mobile/id6762488844";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center justify-between p-6 lg:px-12">
        <div className="flex items-center gap-2 text-primary font-semibold text-xl">
          <Heart className="w-7 h-7 fill-current" />
          MyZolve Connect
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">Log in</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="rounded-full px-6">Join your circle</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center text-center px-6 pt-20 pb-32">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
          <Sparkles className="w-4 h-4" />
          For families and trusted circles
        </div>
        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-foreground max-w-4xl mb-6">
          A supportive home for <span className="text-primary relative inline-block">
            mutual aid
            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="2" fill="transparent"/>
            </svg>
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed">
          Request financial support, track gentle reminders, and exchange services with the people you trust most. No cold fintech energy. Just care.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-xl">
          <Link href="/sign-up" className="w-full sm:flex-1">
            <Button size="lg" className="w-full rounded-full text-lg h-14">
              Get Started <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="w-full sm:flex-1"
            data-testid="link-app-store-hero"
          >
            <Button
              size="lg"
              variant="outline"
              className="w-full rounded-full text-lg h-14"
            >
              <Apple className="mr-2 w-5 h-5 fill-current" />
              Download on the App Store
            </Button>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mt-32 text-left">
          <div className="bg-card p-8 rounded-3xl shadow-sm border border-card-border">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Warm Requests</h3>
            <p className="text-muted-foreground leading-relaxed">Ask for help without the awkwardness. Share your needs with your circle and let them support you in their own time.</p>
          </div>
          <div className="bg-card p-8 rounded-3xl shadow-sm border border-card-border">
            <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center mb-6">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Gentle Ledger</h3>
            <p className="text-muted-foreground leading-relaxed">Keep track of returned support without making it feel like debt. Gentle reminders keep things clear and friendly.</p>
          </div>
          <div className="bg-card p-8 rounded-3xl shadow-sm border border-card-border">
            <div className="w-12 h-12 bg-accent text-accent-foreground rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Service Exchange</h3>
            <p className="text-muted-foreground leading-relaxed">Offer to babysit, help move, or cook a meal. Exchange care and time just as easily as financial support.</p>
          </div>
        </div>

        <div className="w-full max-w-5xl mt-24">
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-10 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-5">
              <Sparkles className="w-4 h-4" />
              The 100 Circle Initiative
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 max-w-2xl">
              Communities were never meant to be algorithms.
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mb-8">
              Join the Circle Builder Program and help create the next generation
              of local support networks.
            </p>
            <Link href="/circle-builder">
              <Button size="lg" className="rounded-full text-lg h-14 px-8">
                Become a Founding Circle Builder
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
