// Single source of truth for the guided in-app tutorial.
// Both the web app (artifacts/myzolve-connect) and the mobile app
// (artifacts/myzolve-connect-mobile) import these step definitions so the
// copy can never drift between platforms.
//
// Each step has a stable `id`, warm non-technical copy, and two icon hints:
//   - `featherIcon` — name from @expo/vector-icons / Feather (used on mobile)
//   - `lucideIcon`  — name from lucide-react (used on web)
//
// Web also uses `webAnchorId` to position a popover next to a real DOM
// element (a nav link or a dashboard card).  When no anchor element is
// present on the current page, the web overlay falls back to a centered
// card.  Mobile ignores `webAnchorId`.

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  /** Feather icon name for mobile rendering. */
  featherIcon: string;
  /** Lucide icon name for web rendering. */
  lucideIcon:
    | "LayoutDashboard"
    | "MessageSquareHeart"
    | "HandHeart"
    | "Calendar"
    | "Sparkles"
    | "UserCircle"
    | "PartyPopper";
  /** DOM `data-tutorial-target` value to anchor the web popover to. */
  webAnchorId?: string;
};

export const TUTORIAL_STEPS: ReadonlyArray<TutorialStep> = [
  {
    id: "dashboard",
    title: "This is your home",
    body:
      "Your dashboard is where you land each time. It gives you a quick read on what's happening in your circles — no hunting required.",
    featherIcon: "home",
    lucideIcon: "LayoutDashboard",
    webAnchorId: "nav-dashboard",
  },
  {
    id: "wall",
    title: "Here's where your wall lives",
    body:
      "The wall is for everyday updates and little moments — a photo, a note, a thank-you. It's the gentle heartbeat of your circle.",
    featherIcon: "message-circle",
    lucideIcon: "MessageSquareHeart",
    webAnchorId: "dashboard-card-wall",
  },
  {
    id: "requests",
    title: "Asking for support",
    body:
      "When you (or someone in your circle) need a hand, requests are the place. Big or small, money or time — share what you need and let people show up.",
    featherIcon: "heart",
    lucideIcon: "HandHeart",
    webAnchorId: "dashboard-card-requests",
  },
  {
    id: "calendar",
    title: "Care, scheduled",
    body:
      "The calendar keeps track of caregiving dates so nothing falls through the cracks — visits, appointments, birthdays, anniversaries.",
    featherIcon: "calendar",
    lucideIcon: "Calendar",
    webAnchorId: "dashboard-card-calendar",
  },
  {
    id: "wrapup",
    title: "Your weekly wrap-up",
    body:
      "Once a week we put together a kind summary of the care that flowed through your circles. We'll quietly let you know it's ready right here in your notifications.",
    featherIcon: "star",
    lucideIcon: "Sparkles",
    webAnchorId: "nav-notifications",
  },
  {
    id: "profile",
    title: "Your profile and settings",
    body:
      "Update your photo, pronouns, notifications and more. You can replay this little tour any time from Settings → Show me around again.",
    featherIcon: "user",
    lucideIcon: "UserCircle",
    webAnchorId: "nav-settings",
  },
  {
    id: "done",
    title: "You're all set",
    body:
      "That's the quick tour. Take your time exploring — and remember, this is a soft place to land. We're glad you're here.",
    featherIcon: "check-circle",
    lucideIcon: "PartyPopper",
  },
];
