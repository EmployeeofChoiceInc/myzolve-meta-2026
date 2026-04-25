import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from '@clerk/react';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import SiteFooter from "@/components/site-footer";
import { initAnalytics, trackPageview } from "@/lib/analytics";
import DashboardPage from "@/pages/dashboard";
import Layout from "@/components/layout";
import CirclesPage from "@/pages/circles";
import CircleDetailPage from "@/pages/circle-detail";
import RequestsPage from "@/pages/requests";
import RequestDetailPage from "@/pages/request-detail";
import ServicesPage from "@/pages/services";
import ServiceDetailPage from "@/pages/service-detail";
import LedgerPage from "@/pages/ledger";
import ActivityPage from "@/pages/activity";
import MembersPage from "@/pages/members";
import SettingsPage from "@/pages/settings";
import InviteAcceptPage from "@/pages/invite-accept";
import OnboardingPage from "@/pages/onboarding";
import NotificationsPage from "@/pages/notifications";
import DiscoverPage from "@/pages/discover";
import ProfilePage from "@/pages/profile";
import WallPage from "@/pages/wall";
import MessagesPage from "@/pages/messages";
import PlusPage from "@/pages/plus";
import { PaywallProvider } from "@/components/paywall-dialog";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
      <SiteFooter />
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center p-4">
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
      <SiteFooter />
    </div>
  );
}

function AnalyticsTracker() {
  const [location] = useLocation();
  useEffect(() => {
    initAnalytics();
  }, []);
  useEffect(() => {
    trackPageview();
  }, [location]);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <Component />
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <AnalyticsTracker />
        <PaywallProvider>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/dashboard"><ProtectedRoute component={DashboardPage} /></Route>
          <Route path="/circles"><ProtectedRoute component={CirclesPage} /></Route>
          <Route path="/circles/:id"><ProtectedRoute component={CircleDetailPage} /></Route>
          <Route path="/circles/:id/requests"><ProtectedRoute component={RequestsPage} /></Route>
          <Route path="/requests/:id"><ProtectedRoute component={RequestDetailPage} /></Route>
          <Route path="/circles/:id/services"><ProtectedRoute component={ServicesPage} /></Route>
          <Route path="/services/:id"><ProtectedRoute component={ServiceDetailPage} /></Route>
          <Route path="/circles/:id/ledger"><ProtectedRoute component={LedgerPage} /></Route>
          <Route path="/circles/:id/activity"><ProtectedRoute component={ActivityPage} /></Route>
          <Route path="/circles/:id/members"><ProtectedRoute component={MembersPage} /></Route>
          <Route path="/settings"><ProtectedRoute component={SettingsPage} /></Route>
          <Route path="/notifications"><ProtectedRoute component={NotificationsPage} /></Route>
          <Route path="/onboarding"><ProtectedRoute component={OnboardingPage} /></Route>
          <Route path="/discover"><ProtectedRoute component={DiscoverPage} /></Route>
          <Route path="/circles/:id/wall"><ProtectedRoute component={WallPage} /></Route>
          <Route path="/profile/:userId"><ProtectedRoute component={ProfilePage} /></Route>
          <Route path="/messages/:userId"><ProtectedRoute component={MessagesPage} /></Route>
          <Route path="/messages"><ProtectedRoute component={MessagesPage} /></Route>
          <Route path="/plus"><ProtectedRoute component={PlusPage} /></Route>
          <Route path="/invite/:token" component={InviteAcceptPage} />
          <Route component={NotFound} />
        </Switch>
        </PaywallProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
