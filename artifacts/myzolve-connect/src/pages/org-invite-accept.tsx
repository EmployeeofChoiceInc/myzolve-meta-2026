import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  usePreviewOrgInvite,
  getPreviewOrgInviteQueryKey,
  useAcceptOrgInvite,
  type AcceptOrgInviteMutationError,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle2, AlertCircle } from "lucide-react";
import SiteFooter from "@/components/site-footer";

function extractError(raw: unknown, fallback: string): string {
  if (
    raw !== null &&
    typeof raw === "object" &&
    "error" in (raw as object) &&
    typeof (raw as Record<string, unknown>).error === "string"
  ) {
    return (raw as Record<string, unknown>).error as string;
  }
  return fallback;
}

export default function OrgInviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { isSignedIn, isLoaded } = useUser();
  const { data: preview, isLoading: previewLoading } = usePreviewOrgInvite(token ?? "", {
    query: { enabled: !!token, queryKey: getPreviewOrgInviteQueryKey(token ?? "") },
  });
  const acceptInvite = useAcceptOrgInvite();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const org = preview?.org;
  const accent = org?.accentColor || undefined;

  function handleAccept() {
    if (!token) return;
    setStatus("loading");
    acceptInvite.mutate(
      { token },
      {
        onSuccess: () => {
          setStatus("success");
          setTimeout(() => setLocation("/dashboard"), 2000);
        },
        onError: (err: AcceptOrgInviteMutationError) => {
          setStatus("error");
          setErrorMessage(
            extractError(err.data, "This invite link may have already been used or expired."),
          );
        },
      },
    );
  }

  if (!isLoaded || previewLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse" />
      </div>
    );
  }

  const OrgBadge = () => (
    <div
      className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden border"
      style={accent ? { borderColor: accent } : undefined}
    >
      {org?.logoUrl ? (
        <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
      ) : (
        <Building2 className="w-8 h-8" style={accent ? { color: accent } : undefined} />
      )}
    </div>
  );

  if (!isSignedIn) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md rounded-3xl shadow-sm">
            <CardHeader className="text-center pb-4">
              <OrgBadge />
              <CardTitle className="text-2xl">
                {org ? `Join ${org.name}` : "You've been invited"}
              </CardTitle>
              <CardDescription>
                Sign in or create an account to join this organization and unlock MyZolve Plus.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button
                className="rounded-full w-full"
                style={accent ? { backgroundColor: accent } : undefined}
                asChild
              >
                <a href={`/sign-in?redirect_url=/org-invite/${token}`}>Sign In</a>
              </Button>
              <Button variant="outline" className="rounded-full w-full" asChild>
                <a href={`/sign-up?redirect_url=/org-invite/${token}`}>Create Account</a>
              </Button>
            </CardContent>
          </Card>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const inviteInvalid = preview && !preview.valid;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-3xl shadow-sm">
          <CardHeader className="text-center pb-4">
            {status === "success" ? (
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-secondary/10">
                <CheckCircle2 className="w-8 h-8 text-secondary" />
              </div>
            ) : status === "error" || inviteInvalid ? (
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-destructive/10">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
            ) : (
              <OrgBadge />
            )}

            {status === "success" ? (
              <>
                <CardTitle className="text-2xl">Welcome aboard</CardTitle>
                <CardDescription>
                  You've joined {org?.name ?? "the organization"}. Taking you to your dashboard...
                </CardDescription>
              </>
            ) : status === "error" ? (
              <>
                <CardTitle className="text-2xl">Invite unavailable</CardTitle>
                <CardDescription>{errorMessage}</CardDescription>
              </>
            ) : inviteInvalid ? (
              <>
                <CardTitle className="text-2xl">Invite unavailable</CardTitle>
                <CardDescription>
                  This invite has expired or has already been used.
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-2xl">Join {org?.name ?? "this organization"}</CardTitle>
                <CardDescription>
                  Accepting gives you MyZolve Plus while you're a member.
                </CardDescription>
              </>
            )}
          </CardHeader>

          {status !== "success" && (
            <CardContent className="flex flex-col gap-3">
              {status === "error" || inviteInvalid ? (
                <Button
                  variant="outline"
                  className="rounded-full w-full"
                  onClick={() => setLocation("/dashboard")}
                >
                  Go to Dashboard
                </Button>
              ) : (
                <Button
                  className="rounded-full w-full"
                  style={accent ? { backgroundColor: accent } : undefined}
                  onClick={handleAccept}
                  disabled={status === "loading"}
                >
                  {status === "loading" ? "Joining..." : "Accept & Join"}
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
