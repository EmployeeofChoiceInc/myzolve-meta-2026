import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAcceptInvitation, type AcceptInvitationMutationError } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HandHeart, CheckCircle2, AlertCircle } from "lucide-react";
import SiteFooter from "@/components/site-footer";

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { isSignedIn, isLoaded } = useUser();
  const acceptInvitation = useAcceptInvitation();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  function handleAccept() {
    if (!token) return;
    setStatus("loading");
    acceptInvitation.mutate(
      { token },
      {
        onSuccess: () => {
          setStatus("success");
          setTimeout(() => setLocation("/dashboard"), 2000);
        },
        onError: (err: AcceptInvitationMutationError) => {
          setStatus("error");
          const raw: unknown = err.data;
          const message =
            raw !== null &&
            typeof raw === "object" &&
            "error" in (raw as object) &&
            typeof (raw as Record<string, unknown>).error === "string"
              ? (raw as Record<string, unknown>).error as string
              : "This invite link may have already been used or expired.";
          setErrorMessage(message);
        },
      }
    );
  }

  if (!isLoaded) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-3xl shadow-sm">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <HandHeart className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">You've been invited</CardTitle>
            <CardDescription>Sign in or create an account to join this trusted circle.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button className="rounded-full w-full" asChild>
              <a href={`/sign-in?redirect_url=/invite/${token}`}>Sign In</a>
            </Button>
            <Button variant="outline" className="rounded-full w-full" asChild>
              <a href={`/sign-up?redirect_url=/invite/${token}`}>Create Account</a>
            </Button>
          </CardContent>
        </Card>
      </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-3xl shadow-sm">
        <CardHeader className="text-center pb-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            status === "success" ? "bg-secondary/10" : 
            status === "error" ? "bg-destructive/10" : 
            "bg-primary/10"
          }`}>
            {status === "success" ? (
              <CheckCircle2 className="w-8 h-8 text-secondary" />
            ) : status === "error" ? (
              <AlertCircle className="w-8 h-8 text-destructive" />
            ) : (
              <HandHeart className="w-8 h-8 text-primary" />
            )}
          </div>

          {status === "success" ? (
            <>
              <CardTitle className="text-2xl">Welcome to the circle</CardTitle>
              <CardDescription>You've joined successfully. Taking you to your dashboard...</CardDescription>
            </>
          ) : status === "error" ? (
            <>
              <CardTitle className="text-2xl">Invite unavailable</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </>
          ) : (
            <>
              <CardTitle className="text-2xl">You've been invited</CardTitle>
              <CardDescription>You're about to join a trusted circle on MyZolve Connect.</CardDescription>
            </>
          )}
        </CardHeader>

        {status !== "success" && (
          <CardContent className="flex flex-col gap-3">
            {status === "error" ? (
              <Button variant="outline" className="rounded-full w-full" onClick={() => setLocation("/dashboard")}>
                Go to Dashboard
              </Button>
            ) : (
              <Button
                className="rounded-full w-full"
                onClick={handleAccept}
                disabled={status === "loading"}
              >
                {status === "loading" ? "Joining..." : "Accept & Join Circle"}
              </Button>
            )}
          </CardContent>
        )}
      </Card>
      </div>
      <SiteFooter />
    </div>
  );
}
