import { useState } from "react";
import { Link } from "wouter";
import {
  Heart,
  Users,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Megaphone,
  Calendar,
  HandHeart,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import SiteFooter from "@/components/site-footer";
import { useToast } from "@/hooks/use-toast";
import {
  useSubmitCircleBuilderApplication,
  type CircleBuilderApplicationInput,
} from "@/hooks/use-api";

const WHO_WE_LOOK_FOR = [
  "Church leaders",
  "PTA members",
  "Neighborhood organizers",
  "Coaches",
  "Community activists",
  "Nonprofit leaders",
  "Parent groups",
  "Alumni groups",
  "Apartment community leaders",
  "Small business owners",
  "Educators",
  "Artists",
  "Wellness facilitators",
];

const BENEFITS = [
  "Founder badge",
  "Early feature access",
  "Direct influence on product development",
  "Quarterly strategy sessions with the MyZolve team",
  "Recognition on website and social channels",
  "Exclusive Founder Circle community",
];

const PHASES = [
  {
    icon: Users,
    title: "Phase 1 — Recruit",
    body: "Recruit 10–25 trusted members from your family network, ministry, neighborhood group, parent community, friend collective, or professional network.",
  },
  {
    icon: Calendar,
    title: "Phase 2 — Host",
    body: "Host one gathering, virtual or in person, to introduce members to the mission, the circle, and the platform.",
  },
  {
    icon: HandHeart,
    title: "Phase 3 — Facilitate",
    body: "Facilitate connection: resource sharing, community projects, skill exchanges, lending and borrowing, support requests, celebrations, and volunteer opportunities.",
  },
];

type FormState = CircleBuilderApplicationInput;

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  location: "",
  communityServed: "",
  networkSize: "",
  motivation: "",
  desiredImpact: "",
  willingToHost: true,
};

export default function CircleBuilderPage() {
  const { toast } = useToast();
  const submit = useSubmitCircleBuilderApplication();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const requiredText = [
    form.name,
    form.email,
    form.location,
    form.communityServed,
    form.networkSize,
    form.motivation,
    form.desiredImpact,
  ];
  const isComplete = requiredText.every((v) => v.trim().length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete) {
      toast({
        title: "Please complete all fields",
        description: "Every question is required to apply.",
        variant: "destructive",
      });
      return;
    }
    try {
      await submit.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        location: form.location.trim(),
        communityServed: form.communityServed.trim(),
        networkSize: form.networkSize.trim(),
        motivation: form.motivation.trim(),
        desiredImpact: form.desiredImpact.trim(),
        willingToHost: form.willingToHost,
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast({
        title: "Something went wrong",
        description:
          err instanceof Error
            ? err.message
            : "We couldn't submit your application. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center justify-between p-6 lg:px-12">
        <Link href="/">
          <div className="flex items-center gap-2 text-primary font-semibold text-xl cursor-pointer">
            <Heart className="w-7 h-7 fill-current" />
            MyZolve Connect
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              Log in
            </Button>
          </Link>
          <a href="#apply">
            <Button className="rounded-full px-6">Apply now</Button>
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="flex flex-col items-center text-center px-6 pt-16 pb-20 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            The 100 Circle Initiative
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
            Communities Were Never Meant To Be Algorithms.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mb-4 leading-relaxed">
            They were meant to be people.
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            Join the MyZolve Connect Circle Builder Program and help create the
            next generation of local support networks.
          </p>
          <a href="#apply">
            <Button size="lg" className="rounded-full text-lg h-14 px-8">
              Apply to Become a Founding Circle Builder
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </a>
        </section>

        {/* Mission */}
        <section className="px-6 py-16 bg-card/40 border-y border-card-border">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
            <p className="text-lg text-muted-foreground leading-relaxed mb-8">
              Build 100 real-world support circles that strengthen local
              communities through trust, connection, mutual aid, and shared
              resources.
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              {["Not followers.", "Not influencers.", "Not content creators."].map(
                (t) => (
                  <span
                    key={t}
                    className="px-4 py-2 rounded-full bg-muted text-muted-foreground line-through"
                  >
                    {t}
                  </span>
                ),
              )}
              <span className="px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold">
                Community builders.
              </span>
            </div>
          </div>
        </section>

        {/* Who we're looking for */}
        <section className="px-6 py-16 max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Who We're Looking For</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              People who already bring others together. The ideal Circle Builder
              already has a community — we simply give them the infrastructure to
              strengthen it.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {WHO_WE_LOOK_FOR.map((role) => (
              <span
                key={role}
                className="px-4 py-2 rounded-full bg-card border border-card-border text-sm text-foreground"
              >
                {role}
              </span>
            ))}
          </div>
        </section>

        {/* What they receive */}
        <section className="px-6 py-16 bg-card/40 border-y border-card-border">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Award className="w-4 h-4" />
                Founder Circle Status
              </div>
              <h2 className="text-3xl font-bold mb-3">What You Receive</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                The first 100 Circle Builders become Founding Ambassadors of
                MyZolve Connect.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {BENEFITS.map((b) => (
                <div
                  key={b}
                  className="flex items-center gap-3 bg-background p-4 rounded-2xl border border-card-border"
                >
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  <span className="text-foreground">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Responsibilities */}
        <section className="px-6 py-16 max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Circle Builder Responsibilities</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We never say "join another social network." Instead: build your
              community, strengthen existing relationships, and help people help
              each other.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PHASES.map((p) => (
              <div
                key={p.title}
                className="bg-card p-8 rounded-3xl shadow-sm border border-card-border"
              >
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
                  <p.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{p.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Application form */}
        <section id="apply" className="px-6 py-16 bg-card/40 border-t border-card-border scroll-mt-8">
          <div className="max-w-2xl mx-auto">
            {submitted ? (
              <div className="bg-background rounded-3xl border border-card-border p-10 text-center">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Application received</h2>
                <p className="text-muted-foreground mb-8">
                  Thank you for applying to the Circle Builder Program. The
                  MyZolve team will review your application and reach out soon.
                </p>
                <Link href="/">
                  <Button variant="outline" className="rounded-full">
                    Back to home
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-10">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                    <Megaphone className="w-4 h-4" />
                    Apply now
                  </div>
                  <h2 className="text-3xl font-bold mb-3">
                    Become a Founding Circle Builder
                  </h2>
                  <p className="text-muted-foreground">
                    Tell us about you and the community you serve.
                  </p>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="bg-background rounded-3xl border border-card-border p-6 sm:p-8 space-y-6"
                  data-testid="form-circle-builder"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="Your full name"
                        data-testid="input-name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="you@example.com"
                        data-testid="input-email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">City/State</Label>
                    <Input
                      id="location"
                      value={form.location}
                      onChange={(e) => update("location", e.target.value)}
                      placeholder="City, State"
                      data-testid="input-location"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="communityServed">
                      What community do you currently serve?
                    </Label>
                    <Textarea
                      id="communityServed"
                      value={form.communityServed}
                      onChange={(e) =>
                        update("communityServed", e.target.value)
                      }
                      placeholder="Tell us about the people you bring together."
                      rows={3}
                      data-testid="input-community-served"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="networkSize">
                      Approximately how many people are in your network?
                    </Label>
                    <Input
                      id="networkSize"
                      value={form.networkSize}
                      onChange={(e) => update("networkSize", e.target.value)}
                      placeholder="e.g. 30, around 100, 250+"
                      data-testid="input-network-size"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="motivation">
                      Why do you want to build a MyZolve Connect Circle?
                    </Label>
                    <Textarea
                      id="motivation"
                      value={form.motivation}
                      onChange={(e) => update("motivation", e.target.value)}
                      placeholder="Share what draws you to this."
                      rows={4}
                      data-testid="input-motivation"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="desiredImpact">
                      What impact would you like your circle to have?
                    </Label>
                    <Textarea
                      id="desiredImpact"
                      value={form.desiredImpact}
                      onChange={(e) => update("desiredImpact", e.target.value)}
                      placeholder="Describe the difference you hope to make."
                      rows={4}
                      data-testid="input-desired-impact"
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>
                      Are you willing to host one community gathering within 60
                      days?
                    </Label>
                    <div className="flex gap-3">
                      {[
                        { label: "Yes", value: true },
                        { label: "No", value: false },
                      ].map((opt) => (
                        <button
                          type="button"
                          key={opt.label}
                          onClick={() => update("willingToHost", opt.value)}
                          data-testid={`button-host-${opt.label.toLowerCase()}`}
                          className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                            form.willingToHost === opt.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-card-border bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full rounded-full h-14 text-lg"
                    disabled={submit.isPending}
                    data-testid="button-submit-application"
                  >
                    {submit.isPending ? "Submitting..." : "Submit application"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
