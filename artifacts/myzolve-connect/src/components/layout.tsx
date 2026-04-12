import { Link, useLocation } from "wouter";
import { Heart, Home, Users, Search, Bell, Settings, LogOut, Menu } from "lucide-react";
import { useClerk, useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  const navItems = [
    { icon: Home, label: "Home", href: "/dashboard" },
    { icon: Users, label: "My Circles", href: "/circles" },
    { icon: Search, label: "Discover Needs", href: "/discover" },
  ];

  const NavLinks = () => (
    <>
      {navItems.map((item) => (
        <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${location === item.href ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
          <item.icon className="w-5 h-5" />
          {item.label}
        </Link>
      ))}
    </>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-card">
        <Link href="/dashboard" className="flex items-center gap-2 text-primary font-semibold text-lg">
          <Heart className="w-6 h-6 fill-current" />
          MyZolve Connect
        </Link>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] sm:w-[320px] p-6 bg-card border-r-0">
            <nav className="flex flex-col gap-2 mt-8">
              <NavLinks />
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[280px] shrink-0 border-r bg-card p-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-primary font-semibold text-xl mb-10 px-2">
          <Heart className="w-7 h-7 fill-current" />
          MyZolve Connect
        </Link>
        <nav className="flex flex-col gap-2 flex-1">
          <NavLinks />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
        {/* Top bar for desktop with user menu */}
        <header className="hidden md:flex items-center justify-end p-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
              <Bell className="w-5 h-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10 border border-muted">
                    <AvatarImage src={user?.imageUrl} alt={user?.fullName || "User"} />
                    <AvatarFallback className="bg-primary/10 text-primary">{user?.firstName?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.fullName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer w-full flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
