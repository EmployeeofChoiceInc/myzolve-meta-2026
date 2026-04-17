import { Link } from "wouter";
import { Heart, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/site-footer";

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: April 2026</p>

          <div className="rounded-2xl bg-accent/40 border border-accent-border p-4 text-sm text-foreground mb-8">
            <strong>TODO — legal review required.</strong> This is plain-language
            boilerplate intended as a starting point for MyZolve's lawyer to
            review and tailor before public launch. Do not treat as final legal
            text.
          </div>

          <h2>The agreement</h2>
          <p>
            By using MyZolve Connect ("the Service") you agree to these Terms.
            The Service is provided by MyZolve ("we", "us"). If you do not
            agree, please do not use the Service.
          </p>

          <h2>What MyZolve Connect is</h2>
          <p>
            MyZolve Connect is a private space where families and trusted
            circles can request and offer support, gently track returned
            support, and exchange services. <strong>It is not a bank, a lender,
            a money transmitter, or a payment processor.</strong> We do not
            move money between members. The "ledger" inside Connect is a
            social, informational record kept among consenting members of a
            circle — not a legally binding debt instrument.
          </p>

          <h2>Your account</h2>
          <ul>
            <li>You must be at least 13 years old (or the equivalent age in your jurisdiction) to use the Service.</li>
            <li>You're responsible for keeping your account credentials safe and for activity in your account.</li>
            <li>You agree to provide accurate information and to keep it current.</li>
          </ul>

          <h2>Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service to harass, threaten, defraud, or harm other people.</li>
            <li>Misrepresent your identity or another person's identity.</li>
            <li>Use the Service for unlawful activity, money laundering, or to evade legal obligations.</li>
            <li>Try to break, probe, or interfere with the Service's security or infrastructure.</li>
          </ul>

          <h2>Content you post</h2>
          <p>
            You keep ownership of the content you post inside your circles. You
            grant MyZolve a limited license to host and display that content
            for the purpose of operating the Service for you and the members of
            your circle.
          </p>

          <h2>No financial advice, no guarantees</h2>
          <p>
            The Service is provided "as is", without warranties of any kind.
            Nothing inside MyZolve Connect is financial, tax, or legal advice.
            We do not guarantee that any member of your circle will repay
            support, return funds, or fulfill any service offer.
          </p>

          <h2>Liability</h2>
          <p>
            To the fullest extent permitted by law, MyZolve is not liable for
            any indirect, incidental, special, or consequential damages arising
            out of your use of the Service. <em>TODO: legal to finalize the
            liability cap and jurisdictional carve-outs.</em>
          </p>

          <h2>Termination</h2>
          <p>
            You can stop using the Service at any time. We may suspend or
            terminate accounts that violate these Terms or that put other
            members at risk.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these Terms over time. If a change is material, we'll
            give you reasonable notice in-app or by email before it takes
            effect.
          </p>

          <h2>Contact</h2>
          <p>
            Questions? Email <a href="mailto:hello@myzolve.com">hello@myzolve.com</a>.
          </p>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
