import { useParams, Link } from "wouter";
import { useListServicePosts, useCreateServicePost, getListServicePostsQueryKey } from "@workspace/api-client-react";
import { Sparkles, Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const serviceFormSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters."),
  description: z.string().min(5, "Description is required"),
  serviceType: z.enum(["offer", "request"]),
  category: z.string().min(2, "Category is required"),
  availability: z.string().optional(),
  locationMode: z.enum(["remote", "in_person", "hybrid"]),
  exchangePreference: z.enum(["free", "barter", "paid_later", "open_to_discuss"]),
  estimatedValue: z.number().optional(),
});

export default function ServicesPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: services, isLoading } = useListServicePosts(circleId);
  const createService = useCreateServicePost();

  const form = useForm<z.infer<typeof serviceFormSchema>>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      title: "",
      description: "",
      serviceType: "offer",
      category: "general",
      locationMode: "hybrid",
      exchangePreference: "free" as const,
    },
  });

  function onSubmit(values: z.infer<typeof serviceFormSchema>) {
    createService.mutate({
      circleId,
      data: {
        ...values,
        visibilityScope: "whole_circle",
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListServicePostsQueryKey(circleId) });
        setOpen(false);
        form.reset();
        toast({ title: "Service posted", description: "Your service has been shared with the circle." });
      }
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/circles/${circleId}`} className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors">
          Back to Circle
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Service Exchange</h1>
          <p className="text-muted-foreground mt-1">Offer your time or request a helping hand.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full">
              <Plus className="mr-2 w-4 h-4" /> Post a Service
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Share a Service</DialogTitle>
              <DialogDescription>
                Offer your skills to the circle or ask for help with a task.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>I want to...</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="offer">Offer a service</SelectItem>
                          <SelectItem value="request">Request a service</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Babysitting for 2 hours, Help moving boxes" {...field} className="rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Childcare, Handyman, Tutoring" {...field} className="rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Details about what you're offering or need..." className="resize-none rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="locationMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="in_person">In Person</SelectItem>
                            <SelectItem value="remote">Remote</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="exchangePreference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Exchange</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="free">Free / Gift</SelectItem>
                            <SelectItem value="barter">Barter</SelectItem>
                            <SelectItem value="paid_later">Pay Later</SelectItem>
                            <SelectItem value="open_to_discuss">Open to Discuss</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={createService.isPending} className="rounded-full">
                    {createService.isPending ? "Posting..." : "Post Service"}
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
            <div key={i} className="h-56 bg-muted/50 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : services?.length === 0 ? (
        <Card className="rounded-3xl bg-card border-border/50 shadow-none py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center text-accent-foreground mb-4">
              <Sparkles className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="font-semibold text-xl mb-2">No services posted yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Be the first to offer a skill or request help from your trusted circle.
            </p>
            <Button className="rounded-full" onClick={() => setOpen(true)}>Post a Service</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services?.map((service) => (
            <Link key={service.id} href={`/services/${service.id}`}>
              <Card className="rounded-3xl hover:shadow-md transition-all cursor-pointer h-full border-border/50 flex flex-col hover:-translate-y-1">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <Badge variant="outline" className={`rounded-full px-2.5 font-medium border-transparent ${service.serviceType === 'offer' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                      {service.serviceType === 'offer' ? 'Offering' : 'Requesting'}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-2.5 font-medium bg-background">
                      {service.category}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl leading-tight">{service.title}</CardTitle>
                  <CardDescription className="text-sm">
                    By <span className="font-medium text-foreground">{service.createdByName}</span>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pb-5 flex-1 flex flex-col">
                  <div className="flex items-center text-xs text-muted-foreground mb-4 gap-4">
                    <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {service.locationMode.replace('_', ' ')}</span>
                    <span className="capitalize text-accent-foreground font-medium px-2 py-0.5 bg-accent/10 rounded-md">
                      {service.exchangePreference}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3 mt-auto">
                    {service.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
