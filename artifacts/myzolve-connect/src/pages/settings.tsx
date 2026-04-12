import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const profileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  timezone: z.string().min(1, "Timezone is required"),
});

export default function SettingsPage() {
  const { data: profile, isLoading } = useGetMe();
  const updateMe = useUpdateMe();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initialized = useRef(false);

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      displayName: "",
      timezone: "UTC",
    },
  });

  useEffect(() => {
    if (profile && !initialized.current) {
      form.reset({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        displayName: profile.displayName || "",
        timezone: profile.timezone || "UTC",
      });
      initialized.current = true;
    }
  }, [profile, form]);

  function onSubmit(values: z.infer<typeof profileFormSchema>) {
    updateMe.mutate({
      data: values
    }, {
      onSuccess: (updatedProfile) => {
        toast({ title: "Profile updated", description: "Your changes have been saved successfully." });
        queryClient.setQueryData(['/api/me'], updatedProfile);
      },
      onError: () => {
        toast({ title: "Error", description: "Could not update profile.", variant: "destructive" });
      }
    });
  }

  if (isLoading) {
    return <div className="p-8 animate-pulse"><div className="h-8 bg-muted w-1/4 rounded mb-8"></div><div className="h-96 bg-muted rounded-3xl max-w-2xl"></div></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your personal profile and preferences.</p>
      </div>

      <Card className="rounded-3xl border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle>Personal Profile</CardTitle>
          <CardDescription>This is how you will appear to your trusted circles.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane" {...field} className="rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} className="rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane D." {...field} className="rounded-xl" />
                    </FormControl>
                    <CardDescription className="text-xs mt-1">
                      This is what others will see when you post requests or offer support.
                    </CardDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select a timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="pt-4 border-t border-border/50 flex justify-end">
                <Button type="submit" disabled={updateMe.isPending} className="rounded-full">
                  {updateMe.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
