import { useParams, Link } from "wouter";
import { useUserProfile, objectPathToUrl } from "@/hooks/use-api";
import { ArrowLeft, MapPin, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const targetUserId = parseInt(userId!);
  const { data: profile, isLoading, isError } = useUserProfile(isNaN(targetUserId) ? null : targetUserId);

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Card className="rounded-3xl border-border/50 shadow-none">
          <CardContent className="p-8 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-500">
        <Button variant="ghost" className="rounded-full gap-2" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Card className="rounded-3xl border-border/50 shadow-none">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="font-medium">Profile not available</p>
            <p className="text-sm mt-1">You need to share a circle with this person to view their profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = profile.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avatarSrc = objectPathToUrl(profile.avatarObjectPath);

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button variant="ghost" className="rounded-full gap-2 -ml-2" onClick={() => window.history.back()}>
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      <Card className="rounded-3xl border-border/50 shadow-none overflow-hidden">
        <div className="h-20 bg-gradient-to-br from-primary/20 to-secondary/20" />
        <CardContent className="p-6 pt-0">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <Avatar className="w-20 h-20 border-4 border-background shadow-sm">
              {avatarSrc && <AvatarImage src={avatarSrc} alt={profile.displayName} />}
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{profile.displayName}</h1>
              {profile.firstName && (
                <p className="text-muted-foreground text-sm">{profile.firstName}</p>
              )}
            </div>

            {profile.bio && (
              <p className="text-sm text-foreground/80 leading-relaxed">{profile.bio}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {profile.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {profile.location}
                </span>
              )}
              {profile.commonCircleCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {profile.commonCircleCount} circle{profile.commonCircleCount !== 1 ? "s" : ""} in common
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Member since {format(new Date(profile.memberSince), "MMMM yyyy")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
