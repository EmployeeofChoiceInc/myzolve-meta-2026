import { Link } from "wouter";
import { ArrowRight, Apple, Users, Leaf, ShieldCheck, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/site-footer";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/myzolve-connect-mobile/id6762488844";

const BASE = import.meta.env.BASE_URL;

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center justify-between p-6 lg:px-12">
        <div className="flex items-center gap-3">
          <img
            src={`${BASE}logo-mark.png`}
            alt=""
            className="h-12 w-12 object-contain"
          />
          <span className="text-2xl font-bold tracking-tight text-foreground">
            MyZolve <span className="text-primary">Connect</span>
          </span>
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
        {/* Hero */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary text-sm font-medium mb-8">
          <Leaf className="w-4 h-4" />
          For families, neighbors &amp; resilient circles
        </div>

        <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-foreground max-w-4xl mb-6">
          Your community is your{" "}
          <span className="text-primary relative inline-block">
            most important resource
            <svg className="absolute -bottom-1 left-0 w-full" height="8" viewBox="0 0 100 8" preserveAspectRatio="none">
              <path d="M0 4 Q 50 8 100 4" stroke="currentColor" strokeWidth="2.5" fill="transparent" />
            </svg>
          </span>
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed">
          The people around you are your greatest resource. MyZolve Connect helps your family, neighbors, and trusted circle actually know each other — and show up when it counts.
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
            <Button size="lg" variant="outline" className="w-full rounded-full text-lg h-14">
              <Apple className="mr-2 w-5 h-5 fill-current" />
              Download on the App Store
            </Button>
          </a>
        </div>

        {/* Value props */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mt-32 text-left">
          <div className="bg-card p-8 rounded-3xl shadow-sm border border-card-border">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Mutual Aid</h3>
            <p className="text-muted-foreground leading-relaxed">
              Ask for help without the awkwardness. Request financial support, exchange services, and let your circle show up for you — in their own way, in their own time.
            </p>
          </div>
          <div className="bg-card p-8 rounded-3xl shadow-sm border border-card-border">
            <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center mb-6">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Community Resilience</h3>
            <p className="text-muted-foreground leading-relaxed">
              Share what you know, offer what you have, and deepen the connections that matter. The more your circle actually knows each other, the more powerful it becomes — for small favors and the moments that really count.
            </p>
          </div>
          <div className="bg-card p-8 rounded-3xl shadow-sm border border-card-border">
            <div className="w-12 h-12 bg-accent text-accent-foreground rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Your Circle, Your Rules</h3>
            <p className="text-muted-foreground leading-relaxed">
              Build private, invitation-only circles for family, neighbors, faith communities, or any group that looks out for each other. No algorithm decides who's in — you do.
            </p>
          </div>
        </div>

        {/* Resilience banner */}
        <div className="w-full max-w-5xl mt-16">
          <div className="relative overflow-hidden bg-secondary/8 border border-secondary/20 rounded-3xl p-10 flex flex-col items-center text-center">
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "24px 24px"
            }} />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/15 text-secondary text-sm font-medium mb-5">
                <Leaf className="w-4 h-4" />
                Real roots. Real people.
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-4 max-w-2xl">
                The strongest communities are built before they're needed.
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mb-8">
                Whether you're deepening roots in your neighborhood, looking out for your family, or simply finding the people you can count on — your circle is the foundation. Start building it today.
              </p>
              <Link href="/sign-up">
                <Button size="lg" className="rounded-full text-lg h-14 px-8">
                  Build Your Circle
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Circle Builder CTA */}
        <div className="w-full max-w-5xl mt-10">
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-10 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-5">
              <Users className="w-4 h-4" />
              The 100 Circle Initiative
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 max-w-2xl">
              Communities were never meant to be algorithms.
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mb-8">
              Join the Circle Builder Program and help seed the next generation of local resilience networks — one trusted community at a time.
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
