import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Reunion (Org) group-space hooks for the mobile app. These endpoints are
 * not part of the generated OpenAPI client, so — like the web app — we call
 * them directly through `customFetch`. Types mirror the web app's
 * `hooks/use-api.ts` org section so both clients stay in lockstep.
 */

export interface MyOrg {
  id: number;
  name: string;
  planName: string;
  status: string;
  isActive: boolean;
  comped: boolean;
  seatLimit: number;
  seatsUsed: number | null;
  logoUrl: string | null;
  accentColor: string | null;
  myRole: string | null;
}

export interface OrgHomeOrg {
  id: number;
  name: string;
  status: string;
  isActive: boolean;
  comped: boolean;
  planName: string;
  accentColor: string | null;
  logoUrl: string | null;
  welcomeMessage: string | null;
  coverImageUrl: string | null;
  heroEventDate: string | null;
  seatLimit: number;
  seatsUsed: number | null;
  myRole: string | null;
}

export interface OrgAnnouncement {
  id: number;
  title: string | null;
  body: string;
  createdAt: string;
  authorName: string | null;
  authorAvatarObjectPath: string | null;
}

export interface OrgEventRsvpCounts {
  going: number;
  maybe: number;
  cant: number;
}

export interface OrgEventRsvpAttendee {
  userId: number;
  displayName: string | null;
  avatarObjectPath: string | null;
  status: "going" | "maybe" | "cant";
}

export interface OrgEvent {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  rsvpCounts: OrgEventRsvpCounts;
  myRsvp: "going" | "maybe" | "cant" | null;
  rsvps: OrgEventRsvpAttendee[];
}

export interface OrgHomeCircle {
  id: number;
  name: string;
  description: string | null;
  privacyMode: string;
  accentColor: string | null;
  memberCount: number;
  isMember: boolean;
}

export interface OrgMainCirclePost {
  id: number;
  authorName: string | null;
  authorAvatarObjectPath: string | null;
  title: string | null;
  body: string;
  imageObjectPath: string | null;
  createdAt: string;
}

export interface OrgMainCircleCareDate {
  id: number;
  name: string;
  kind: string;
  eventDate: string;
  nextOccurrence: string;
  isAnnual: boolean;
}

export interface OrgMainCircle {
  id: number;
  name: string;
  memberCount: number;
  recentPosts: OrgMainCirclePost[];
  upcomingCareDates: OrgMainCircleCareDate[];
}

export interface OrgHomeMember {
  userId: number;
  role: string;
  displayName: string | null;
  avatarObjectPath: string | null;
}

export interface OrgHome {
  org: OrgHomeOrg;
  canManage: boolean;
  announcements: OrgAnnouncement[];
  events: OrgEvent[];
  mainCircle: OrgMainCircle;
  subCircles: OrgHomeCircle[];
  memberCount: number;
  members: OrgHomeMember[];
}

export function orgHomeKey(orgId: number) {
  return ["org-home", orgId] as const;
}

export function useMyOrgs() {
  return useQuery({
    queryKey: ["orgs-mine"],
    queryFn: () => customFetch<{ orgs: MyOrg[] }>("/api/orgs/mine"),
  });
}

export function useOrgHome(orgId: number) {
  return useQuery({
    queryKey: orgHomeKey(orgId),
    queryFn: () => customFetch<OrgHome>(`/api/orgs/${orgId}/home`),
    enabled: Number.isFinite(orgId) && orgId > 0,
    retry: false,
  });
}

export function useRsvpOrgEvent(orgId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { eventId: number; status: "going" | "maybe" | "cant" }) =>
      customFetch<{
        eventId: number;
        myRsvp: "going" | "maybe" | "cant";
        rsvpCounts: OrgEventRsvpCounts;
      }>(`/api/orgs/${orgId}/events/${data.eventId}/rsvp`, {
        method: "POST",
        body: JSON.stringify({ status: data.status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgHomeKey(orgId) });
    },
  });
}

export function useCreateSubCircle(orgId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string | null;
      accentColor?: string | null;
    }) =>
      customFetch<OrgHomeCircle>(`/api/orgs/${orgId}/circles`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgHomeKey(orgId) });
    },
  });
}
