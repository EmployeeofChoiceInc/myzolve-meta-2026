import { useListCircles, useCreateCircle, getListCirclesQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Plus, Users, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const circleFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  description: z.string().optional(),
  circleType: z.enum(["family", "chosen_family", "friends", "caregiving_circle", "neighborhood_circle", "other"]),
  currency: z.string().default("USD"),
});

const CIRCLE_TYPE_LABELS: Record<string, string> = {
  family: "Family",
  chosen_family: "Chosen Family",
  friends: "Friends",
  caregiving_circle: "Caregiving Circle",
  neighborhood_circle: "Neighborhood Circle",
  other: "Other"
};

export default function CirclesPage() {
  const { data: circles, isLoading } = useListCircles();
  const createCircle = useCreateCircle();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof circleFormSchema>>({
    resolver: zodResolver(circleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      circleType: "chosen_family",
      currency: "USD",
    },
  });

  function onSubmit(values: z.infer<typeof circleFormSchema>) {
    createCircle.mutate({
      data: values
    }, {
      onSuccess: (newCircle) => {
        queryClient.invalidateQueries({ queryKey: getListCirclesQueryKey() });
        setOpen(false);
        form.reset();
        toast({ title: "Circle created", description: "Your new trusted circle is ready." });
        setLocation(`/circles/${newCircle.id}`);
      },
      onError: () => {
        toast({ title: "Error", description: "Could not create circle. Please try again.", variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">My Circles</h1>
          <p className="text-muted-foreground mt-1">The trusted groups you share support with.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full">
              <Plus className="mr-2 w-4 h-4" /> Create Circle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-3xl">
            <DialogHeader>
              <DialogTitle>Create a Trusted Circle</DialogTitle>
              <DialogDescription>
                A warm space to share support, request help, and offer care.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Circle Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. The Village, Chosen Family" {...field} className="rounded-xl" />
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
                      <FormLabel>Type of Circle</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(CIRCLE_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
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
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What brings this circle together?" 
                          className="resize-none rounded-xl" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={createCircle.isPending} className="rounded-full">
                    {createCircle.isPending ? "Creating..." : "Create Circle"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-muted/50 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : circles?.length === 0 ? (
        <Card className="rounded-3xl bg-primary/5 border-primary/10 shadow-none py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
              <Heart className="w-8 h-8" />
            </div>
            <h3 className="font-semibold text-xl mb-2">You're not part of any circles yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Create a space for your family, friends, or neighbors to offer and receive support in a warm, trusted environment.
            </p>
            <Button onClick={() => setOpen(true)} className="rounded-full">
              Create your first circle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {circles?.map((circle) => (
            <Link key={circle.id} href={`/circles/${circle.id}`}>
              <Card className="rounded-3xl hover:shadow-md transition-shadow cursor-pointer h-full border-border/50 flex flex-col">
                <CardHeader className="pb-3 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div className="bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                      {CIRCLE_TYPE_LABELS[circle.circleType] || circle.circleType}
                    </div>
                    {circle.myRole && (
                      <div className="text-xs text-muted-foreground capitalize">
                        {circle.myRole.replace('_', ' ')}
                      </div>
                    )}
                  </div>
                  <CardTitle className="text-xl">{circle.name}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-2 text-sm">
                    {circle.description || "A trusted circle for mutual support."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 pb-5">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="w-4 h-4 mr-1.5" />
                    <span>{circle.memberCount || 1} member{(circle.memberCount || 1) !== 1 ? 's' : ''}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
