import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useApplyCircleVerification } from "@/hooks/use-api";
import { usePaywall } from "@/components/paywall-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCircleQueryKey } from "@workspace/api-client-react";

const schema = z.object({
  legalName: z.string().min(2, "Legal name is required").max(200),
  orgType: z.enum(["nonprofit", "religious", "school", "neighborhood", "other"]),
  description: z.string().min(20, "Tell us a bit more (at least 20 characters)").max(1000),
  contactEmail: z.string().email("Enter a valid email"),
  supportingUrl: z
    .string()
    .max(2000)
    .url("Enter a valid URL")
    .optional()
    .or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

const ORG_TYPE_LABELS: Record<FormValues["orgType"], string> = {
  nonprofit: "Nonprofit / 501(c)(3)",
  religious: "Religious / faith community",
  school: "School / education",
  neighborhood: "Neighborhood / mutual aid",
  other: "Other",
};

type Props = {
  circleId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ApplyVerificationDialog({ circleId, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const paywall = usePaywall();
  const apply = useApplyCircleVerification(circleId);
  const qc = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      legalName: "",
      orgType: "nonprofit",
      description: "",
      contactEmail: "",
      supportingUrl: "",
    },
  });

  function onSubmit(values: FormValues) {
    apply.mutate(
      {
        legalName: values.legalName.trim(),
        orgType: values.orgType,
        description: values.description.trim(),
        contactEmail: values.contactEmail.trim(),
        supportingUrl: values.supportingUrl?.trim() || null,
      },
      {
        onSuccess: () => {
          toast({
            title: "Application sent",
            description: "We'll review and let you know.",
          });
          qc.invalidateQueries({ queryKey: getGetCircleQueryKey(circleId) });
          onOpenChange(false);
          form.reset();
        },
        onError: (err) => {
          if (paywall.handleApiError(err)) {
            onOpenChange(false);
            return;
          }
          toast({
            title: "Could not submit application",
            description: (err as Error).message,
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="apply-verification-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-[#1D9BF0]" />
            <DialogTitle>Apply for verification</DialogTitle>
          </div>
          <DialogDescription>
            Verified circles get a small badge so members know your circle is invested. Our team reviews each application.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Legal / organization name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Hope Mutual Aid Network" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="orgType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(ORG_TYPE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
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
                  <FormLabel>What does this circle do?</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} placeholder="A few sentences about who you serve and how." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="contact@your-org.com" />
                  </FormControl>
                  <FormDescription>We'll reach out here if we need more details.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supportingUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supporting link (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://your-org.com/about" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={apply.isPending} data-testid="apply-verification-submit">
                {apply.isPending ? "Sending…" : "Send application"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
