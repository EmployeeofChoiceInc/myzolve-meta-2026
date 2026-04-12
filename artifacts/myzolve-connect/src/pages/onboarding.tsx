import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateCircle, getListCirclesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Heart, Users, Link2 } from "lucide-react";

const createCircleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  circleType: z.enum(["family", "chosen_family", "friends", "caregiving_circle", "neighborhood_circle", "other"]),
  description: z.string().max(1000).optional(),
});

type Step = "choose" | "create";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("choose");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCircle = useCreateCircle();

  const form = useForm<z.infer<typeof createCircleSchema>>({
    resolver: zodResolver(createCircleSchema),
    defaultValues: {
      name: "",
      circleType: "family",
      description: "",
    },
  });

  function onSubmit(values: z.infer<typeof createCircleSchema>) {
    createCircle.mutate(
      { data: values },
      {
        onSuccess: (circle) => {
          queryClient.invalidateQueries({ queryKey: getListCirclesQueryKey() });
          toast({ title: "Circle created", description: `Welcome to ${circle.name}!` });
          navigate(`/circles/${circle.id}`);
        },
        onError: () => {
          toast({ title: "Could not create circle", variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome to MyZolve Connect</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            A private space for families and trusted circles to support each other — financially and beyond.
          </p>
        </div>

        {step === "choose" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card
              className="rounded-3xl border-border/50 shadow-none cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
              onClick={() => setStep("create")}
            >
              <CardHeader className="pb-3">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl">Create a Circle</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Start a private circle for your family or trusted group and invite people you care about.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="rounded-full w-full" onClick={() => setStep("create")}>
                  Create my Circle
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-border/50 shadow-none">
              <CardHeader className="pb-3">
                <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary mb-4">
                  <Link2 className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl">Join a Circle</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  Already have an invite link or email invitation? Follow the link from your invitation to join.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-2xl p-4 leading-relaxed">
                  Check your email for an invite link, or ask the circle owner to send you one. Invite links look like:
                  <span className="block mt-2 font-mono text-xs text-muted-foreground/80 break-all">
                    myzolve.app/invite/abc123...
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="rounded-3xl border-border/50 shadow-none">
            <CardHeader>
              <CardTitle>Create your Circle</CardTitle>
              <CardDescription>Give your circle a name that feels warm and familiar.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Circle Name</FormLabel>
                        <FormControl>
                          <Input placeholder="The Martinez Family" {...field} className="rounded-xl" autoFocus />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="circleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="What kind of circle is this?" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="family">Family</SelectItem>
                            <SelectItem value="chosen_family">Chosen Family</SelectItem>
                            <SelectItem value="friends">Friends</SelectItem>
                            <SelectItem value="caregiving_circle">Caregiving Circle</SelectItem>
                            <SelectItem value="neighborhood_circle">Neighborhood Circle</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>About this Circle <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="A short description to help members understand this space..."
                            className="resize-none rounded-xl"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">Only visible to circle members.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => setStep("choose")}>
                      Back
                    </Button>
                    <Button type="submit" disabled={createCircle.isPending} className="rounded-full flex-1">
                      {createCircle.isPending ? "Creating..." : "Create Circle"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
