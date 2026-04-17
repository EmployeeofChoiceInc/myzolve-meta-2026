import { Link } from "wouter";
import { Heart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/site-footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center justify-between p-6 lg:px-12">
        <Link href="/" className="flex items-center gap-2 text-primary font-semibold text-xl">
          <Heart className="w-7 h-7 fill-current" />
          MyZolve Connect
        </Link>
        <Link href="/">
          <Button variant="ghost" className="rounded-full">
            <ArrowLeft className="w-4 h-4 mr-2" /> Home
          </Button>
        </Link>
      </header>

      <main className="flex-1 px-6 pb-20">
        <article className="max-w-3xl mx-auto prose prose-stone">
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: April 2026</p>

          <div className="rounded-2xl bg-accent/40 border border-accent-border p-4 text-sm text-foreground mb-8">
            <strong>TODO — legal review required.</strong> This is plain-language
            boilerplate intended as a starting point for MyZolve's lawyer to
            review and tailor before public launch. Do not treat as final legal
            text.
          </div>

          <h2>The short version</h2>
          <p>
            MyZolve Connect is a private space for families and trusted circles.
            We collect the minimum information needed to run the product, we do
            not sell your data, and we work hard to keep your circle's
            information visible only to the people you've invited.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Account information</strong> — your name, email address,
              and profile picture, provided when you sign in via our
              authentication partner (Clerk).
            </li>
            <li>
              <strong>Circle activity</strong> — the support requests,
              contributions, repayments, services, comments, and messages you
              create inside your circles.
            </li>
            <li>
              <strong>Usage analytics</strong> — anonymous, aggregated page-view
              data via a privacy-friendly analytics provider (Plausible). No
              cookies, no cross-site tracking, no personal identifiers.
            </li>
          </ul>

          <h2>How we use it</h2>
          <ul>
            <li>To provide the core MyZolve Connect product to you and your circle.</li>
            <li>To send you in-app and email notifications about activity in your circles (you control these in Settings).</li>
            <li>To investigate abuse, fraud, and safety issues.</li>
            <li>To improve the product based on aggregated, non-identifying usage patterns.</li>
          </ul>

          <h2>Who can see your information</h2>
          <p>
            Information you post inside a circle is visible only to other
            members of that circle. MyZolve staff may access information when
            strictly necessary for support, debugging, or safety investigations,
            and only under our internal access controls.
          </p>

          <h2>Sub-processors</h2>
          <p>
            We rely on a small set of trusted vendors to operate the service,
            including Clerk (authentication), our cloud hosting provider, and
            Plausible (privacy-friendly analytics). <em>TODO: legal to confirm
            and finalize the full sub-processor list.</em>
          </p>

          <h2>Your rights</h2>
          <p>
            You can access, correct, export, or delete your account information
            at any time by emailing <a href="mailto:privacy@myzolve.com">privacy@myzolve.com</a>.
            <em> TODO: legal to align this section with applicable GDPR / CCPA
            language for our launch jurisdictions.</em>
          </p>

          <h2>Children</h2>
          <p>
            MyZolve Connect is not intended for use by children under 13 (or
            the equivalent age in your jurisdiction).
          </p>

          <h2>Contact</h2>
          <p>
            Questions? Email <a href="mailto:privacy@myzolve.com">privacy@myzolve.com</a>.
          </p>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
