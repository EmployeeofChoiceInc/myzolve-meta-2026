import { useParams, Link } from "wouter";
import {
  useGetSupportRequest,
  useCreateContribution,
  useConfirmReceipt,
  useCreateRepayment,
  useGetMe,
  getGetSupportRequestQueryKey
} from "@workspace/api-client-react";
import { ArrowLeft, HandHeart, CheckCircle2, Clock, RotateCcw, MessageCircle, Send, Heart, Star, Smile, Paperclip, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  useComments,
  useCreateComment,
  useReactions,
  useToggleReaction,
  useAttachments,
  useRequestUploadUrl,
  useCreateAttachment,
  useCreateGratitudeNote,
  usePlaceholderMembers,
} from "@/hooks/use-api";
import { customFetch } from "@workspace/api-client-react";
import { CopilotSwitcher, CopilotAttribution } from "@/components/copilot-switcher";
import { useActingForInCircle } from "@/lib/copilot";

const REACTION_ICONS: Record<string, React.ReactNode> = {
  heart: <Heart className="w-3.5 h-3.5" />,
  support: <HandHeart className="w-3.5 h-3.5" />,
  thank_you: <Star className="w-3.5 h-3.5" />,
  got_it: <Smile className="w-3.5 h-3.5" />,
};

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const requestId = parseInt(id!);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: me } = useGetMe();
  const { data: requestData, isLoading } = useGetSupportRequest(requestId, {
    query: { enabled: !!requestId, queryKey: getGetSupportRequestQueryKey(requestId) }
  });

  const createContribution = useCreateContribution();
  const confirmReceipt = useConfirmReceipt();
  const createRepayment = useCreateRepayment();

  const [offerOpen, setOfferOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [gratitudeOpen, setGratitudeOpen] = useState(false);
  const [gratitudeMessage, setGratitudeMessage] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);

  const [offerForm, setOfferForm] = useState<{
    amount: string;
    contributionType: "loan" | "gift" | "installment" | "partial_support" | "pledge";
    note: string;
    onBehalfOfPlaceholderId: string;
  }>({
    amount: "",
    contributionType: "loan",
    note: "",
    onBehalfOfPlaceholderId: "",
  });

  const [returnForm, setReturnForm] = useState({
    amount: "",
    note: "",
  });
  const [returnProofFile, setReturnProofFile] = useState<File | null>(null);

  const circleId = requestData?.circleId ?? 0;
  const actingForUserId = useActingForInCircle(circleId);

  const { data: placeholders } = usePlaceholderMembers(circleId);
  const { data: comments } = useComments(circleId, "support_request", requestId);
  const { data: reactions } = useReactions(circleId, "support_request", requestId);
  const { data: attachments } = useAttachments(circleId, "support_request", requestId);
  const createComment = useCreateComment(circleId, "support_request", requestId);
  const toggleReaction = useToggleReaction(circleId, "support_request", requestId);
  const requestUploadUrl = useRequestUploadUrl();
  const createAttachment = useCreateAttachment(circleId, "support_request", requestId);
  const createGratitude = useCreateGratitudeNote(circleId);

  if (isLoading) return <div className="p-8 animate-pulse flex flex-col gap-4"><div className="h-8 bg-muted w-1/3 rounded"></div><div className="h-64 bg-muted rounded-3xl"></div></div>;
  if (!requestData) return <div>Request not found</div>;

  const { contributions, repaymentPlan, ...request } = requestData;
  const percentFunded = request.amountRequested > 0 ? Math.min(100, Math.round(((request.amountFunded ?? 0) / request.amountRequested) * 100)) : 0;

  const isCreator = me?.id === request.createdByUserId;

  const contributorIds = (contributions ?? [])
    .map((c) => (c as unknown as { contributorUserId?: number }).contributorUserId)
    .filter((id): id is number => typeof id === "number" && id !== me?.id);

  const handleConfirmReceipt = () => {
    confirmReceipt.mutate({ requestId }, {
      onSuccess: () => {
        toast({ title: "Receipt confirmed", description: "The support has been marked as received." });
        queryClient.invalidateQueries({ queryKey: getGetSupportRequestQueryKey(requestId) });
        if (contributorIds.length > 0) {
          setGratitudeMessage("");
          setGratitudeOpen(true);
        }
      }
    });
  };

  const handleSendGratitude = () => {
    if (!gratitudeMessage.trim() || contributorIds.length === 0) {
      setGratitudeOpen(false);
      return;
    }
    createGratitude.mutate(
      {
        message: gratitudeMessage.trim(),
        targetEntityType: "support_request",
        targetEntityId: requestId,
        recipientUserIds: contributorIds,
      },
      {
        onSuccess: () => {
          toast({ title: "Gratitude sent", description: "Your thank-you was shared with everyone who helped." });
          setGratitudeOpen(false);
          setGratitudeMessage("");
        },
        onError: () => {
          setGratitudeOpen(false);
        },
      }
    );
  };

  const handleOfferSupport = () => {
    if (!offerForm.amount) {
      toast({ title: "Please enter an amount.", variant: "destructive" });
      return;
    }
    createContribution.mutate(
      {
        requestId,
        data: {
          amount: parseFloat(offerForm.amount),
          contributionType: offerForm.contributionType,
          note: offerForm.note || undefined,
          onBehalfOfPlaceholderId: offerForm.onBehalfOfPlaceholderId ? parseInt(offerForm.onBehalfOfPlaceholderId) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Support offered!", description: "Your generosity means a lot." });
          queryClient.invalidateQueries({ queryKey: getGetSupportRequestQueryKey(requestId) });
          setOfferOpen(false);
          setOfferForm({ amount: "", contributionType: "loan", note: "", onBehalfOfPlaceholderId: "" });
        },
        onError: () => {
          toast({ title: "Could not offer support. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleReturnSupport = () => {
    if (!returnForm.amount) {
      toast({ title: "Please enter an amount.", variant: "destructive" });
      return;
    }
    createRepayment.mutate(
      {
        data: {
          requestId,
          amount: parseFloat(returnForm.amount),
          note: returnForm.note || undefined,
        },
      },
      {
        onSuccess: async (repayment) => {
          if (returnProofFile && circleId) {
            try {
              const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
                name: returnProofFile.name,
                size: returnProofFile.size,
                contentType: returnProofFile.type,
                circleId,
              });
              await fetch(uploadURL, {
                method: "PUT",
                body: returnProofFile,
                headers: { "Content-Type": returnProofFile.type },
              });
              await customFetch(
                `/api/circles/${circleId}/attachments/repayment/${repayment.id}`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    storageKey: objectPath,
                    fileName: returnProofFile.name,
                    fileSize: returnProofFile.size,
                    mimeType: returnProofFile.type,
                  }),
                }
              );
            } catch {
              toast({ title: "Return logged, but proof upload failed.", variant: "destructive" });
            }
          }
          toast({ title: "Return logged", description: "Thank you for completing the circle." });
          queryClient.invalidateQueries({ queryKey: getGetSupportRequestQueryKey(requestId) });
          setReturnOpen(false);
          setReturnForm({ amount: "", note: "" });
          setReturnProofFile(null);
        },
        onError: () => {
          toast({ title: "Could not log return. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const handlePostComment = () => {
    if (!commentBody.trim()) return;
    createComment.mutate(
      {
        body: commentBody.trim(),
        ...(actingForUserId ? { actingForUserId } : {}),
      },
      {
        onSuccess: () => {
          setCommentBody("");
          toast({ title: "Comment added" });
        },
        onError: () => {
          toast({ title: "Could not post comment.", variant: "destructive" });
        },
      }
    );
  };

  const handleFileUpload = async (file: File) => {
    if (!circleId) return;
    setUploadingFile(true);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        name: file.name,
        size: file.size,
        contentType: file.type,
        circleId,
      });
      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      await createAttachment.mutateAsync({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storageKey: objectPath,
      });
      toast({ title: "File attached", description: `${file.name} has been attached to this request.` });
    } catch {
      toast({ title: "Upload failed. Please try again.", variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "fully_funded": return "bg-secondary/10 text-secondary";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-primary/10 text-primary";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/circles/${request.circleId}/requests`} className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Requests
        </Link>
      </div>

      <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
          <div className="flex justify-between items-start mb-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`rounded-full px-3 py-1 font-medium ${getStatusColor(request.status)} border-transparent`}>
                {request.status.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 font-medium bg-background">
                {request.category}
              </Badge>
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">{request.title}</CardTitle>
          <CardDescription className="text-base mt-2 text-foreground/80">
            Requested by <span className="font-medium">{request.createdByName}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-8">
          <div>
            <h3 className="font-semibold text-lg mb-2">About this request</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{request.description}</p>
          </div>

          <div className="bg-card border rounded-2xl p-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Support Progress</p>
                <div className="text-3xl font-bold text-primary">
                  ${request.amountFunded ?? 0} <span className="text-lg text-muted-foreground font-normal">of ${request.amountRequested}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground mb-1">Repayment</p>
                <div className="text-foreground font-medium capitalize">{request.repaymentStyle?.replace("_", " ")}</div>
              </div>
            </div>
            <Progress value={percentFunded} className="h-3 bg-primary/10" />

            {request.dueDate && (
              <div className="mt-4 text-sm text-muted-foreground flex items-center">
                <Clock className="w-4 h-4 mr-1.5" /> Needed by {format(new Date(request.dueDate), "MMMM d, yyyy")}
              </div>
            )}
          </div>

          {/* Reactions */}
          {circleId > 0 && (
            <div className="flex gap-2 flex-wrap">
              {(["heart", "support", "thank_you", "got_it"] as const).map((type) => {
                const count = reactions?.counts?.[type] ?? 0;
                const mine = reactions?.myReactions?.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleReaction.mutate(type)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${mine ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {REACTION_ICONS[type]}
                    <span className="capitalize">{type.replace("_", " ")}</span>
                    {count > 0 && <span className="ml-0.5 text-xs opacity-70">{count}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {!isCreator && request.status !== "completed" && request.status !== "fully_funded" && (
              <Button size="lg" className="rounded-full flex-1" onClick={() => setOfferOpen(true)}>
                <HandHeart className="w-5 h-5 mr-2" /> Offer Support
              </Button>
            )}

            {isCreator && (request.status === "partially_funded" || request.status === "fully_funded") && (
              <Button size="lg" variant="secondary" className="rounded-full flex-1" onClick={handleConfirmReceipt} disabled={confirmReceipt.isPending}>
                <CheckCircle2 className="w-5 h-5 mr-2" /> Confirm Receipt
              </Button>
            )}

            {isCreator && request.repaymentExpected && (request.status === "fully_funded" || request.status === "completed") && (
              <Button size="lg" variant="outline" className="rounded-full flex-1" onClick={() => setReturnOpen(true)}>
                <RotateCcw className="w-5 h-5 mr-2" /> Return Support
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contributions List */}
      {contributions && contributions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Support Received</h3>
          <div className="space-y-3">
            {contributions.map((contribution) => (
              <Card key={contribution.id} className="rounded-2xl border-border/50 shadow-none">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                      <HandHeart className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{contribution.contributorName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(contribution.createdAt), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${contribution.amount}</p>
                    <p className="text-xs text-muted-foreground capitalize">{contribution.contributionType}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      {circleId > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-muted-foreground" />
              Files {attachments && attachments.length > 0 && <span className="text-sm font-normal text-muted-foreground">({attachments.length})</span>}
            </h3>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="rounded-full gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
            >
              <Upload className="w-3.5 h-3.5" />
              {uploadingFile ? "Uploading..." : "Attach File"}
            </Button>
          </div>
          {attachments && attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{att.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(att.fileSize)}</p>
                  </div>
                  <a
                    href={att.downloadUrl}
                    download={att.fileName}
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No files attached yet. You can attach receipts, photos, or documents.</p>
          )}
        </div>
      )}

      {/* Comments Section */}
      {circleId > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            Kind Words {comments && comments.length > 0 && <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>}
          </h3>

          <CopilotSwitcher circleId={circleId} className="mb-1" />
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <Textarea
                placeholder="Leave a warm message or word of encouragement..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                className="rounded-2xl resize-none min-h-[80px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePostComment();
                }}
              />
            </div>
            <Button
              size="icon"
              className="rounded-full mt-1 shrink-0"
              onClick={handlePostComment}
              disabled={!commentBody.trim() || createComment.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {comments && comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <Card key={comment.id} className="rounded-2xl border-border/50 shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Link href={`/profile/${comment.authorUserId}`}>
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer">
                          {(comment.authorName ?? "?")[0].toUpperCase()}
                        </div>
                      </Link>
                      <Link href={`/profile/${comment.authorUserId}`}>
                        <span className="font-medium text-sm hover:underline cursor-pointer">{comment.authorName}</span>
                      </Link>
                      <span className="text-xs text-muted-foreground ml-auto">{format(new Date(comment.createdAt), "MMM d")}</span>
                    </div>
                    {comment.actingForName ? (
                      <CopilotAttribution
                        helperName={comment.authorName}
                        forName={comment.actingForName}
                        review={comment.copilotReview ?? null}
                        size="compact"
                      />
                    ) : null}
                    <p className="text-sm text-foreground/90 leading-relaxed">{comment.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => {
                          if (replyingToId === comment.id) {
                            setReplyingToId(null);
                            setReplyBody("");
                          } else {
                            setReplyingToId(comment.id);
                            setReplyBody("");
                          }
                        }}
                      >
                        {replyingToId === comment.id ? "Cancel" : "Reply"}
                      </button>
                      {comment.replyCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"}
                        </span>
                      )}
                    </div>
                    {replyingToId === comment.id && (
                      <div className="flex gap-2 mt-3 items-start">
                        <Textarea
                          placeholder={`Reply to ${comment.authorName}...`}
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          className="rounded-xl resize-none text-sm flex-1"
                          rows={2}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                              if (!replyBody.trim()) return;
                              createComment.mutate(
                                { body: replyBody.trim(), parentCommentId: comment.id, ...(actingForUserId ? { actingForUserId } : {}) },
                                {
                                  onSuccess: () => {
                                    setReplyBody("");
                                    setReplyingToId(null);
                                    toast({ title: "Reply posted" });
                                  },
                                }
                              );
                            }
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="rounded-full shrink-0 mt-0.5"
                          disabled={!replyBody.trim() || createComment.isPending}
                          onClick={() => {
                            if (!replyBody.trim()) return;
                            createComment.mutate(
                              { body: replyBody.trim(), parentCommentId: comment.id, ...(actingForUserId ? { actingForUserId } : {}) },
                              {
                                onSuccess: () => {
                                  setReplyBody("");
                                  setReplyingToId(null);
                                  toast({ title: "Reply posted" });
                                },
                              }
                            );
                          }}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-3 pl-4 border-l-2 border-border/40 space-y-3">
                        {comment.replies.map((reply) => (
                          <div key={reply.id}>
                            <div className="flex items-center gap-2 mb-1">
                              <Link href={`/profile/${reply.authorUserId}`}>
                                <div className="w-5 h-5 rounded-full bg-secondary/10 text-secondary text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer">
                                  {(reply.authorName ?? "?")[0].toUpperCase()}
                                </div>
                              </Link>
                              <Link href={`/profile/${reply.authorUserId}`}>
                                <span className="font-medium text-xs hover:underline cursor-pointer">{reply.authorName}</span>
                              </Link>
                              <span className="text-xs text-muted-foreground ml-auto">{format(new Date(reply.createdAt), "MMM d")}</span>
                            </div>
                            {reply.actingForName ? (
                              <CopilotAttribution
                                helperName={reply.authorName}
                                forName={reply.actingForName}
                                review={reply.copilotReview ?? null}
                                size="compact"
                              />
                            ) : null}
                            <p className="text-sm text-foreground/80 leading-relaxed">{reply.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">Be the first to leave a kind word.</p>
          )}
        </div>
      )}

      {/* Gratitude Prompt Dialog */}
      <Dialog open={gratitudeOpen} onOpenChange={setGratitudeOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Share your gratitude</DialogTitle>
            <DialogDescription>
              Your circle showed up for you. Take a moment to thank everyone who contributed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <Textarea
              placeholder="Thank you so much for your support. It means the world to me..."
              value={gratitudeMessage}
              onChange={(e) => setGratitudeMessage(e.target.value)}
              className="rounded-2xl resize-none min-h-[100px]"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">This will be shared with everyone who offered support.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setGratitudeOpen(false)} className="rounded-full text-muted-foreground">
              Skip for now
            </Button>
            <Button
              onClick={handleSendGratitude}
              disabled={createGratitude.isPending || !gratitudeMessage.trim()}
              className="rounded-full"
            >
              {createGratitude.isPending ? "Sending..." : "Send thanks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Offer Support Dialog */}
      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Offer support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {placeholders && placeholders.length > 0 && (
              <div className="space-y-1.5">
                <Label>Offering on behalf of (optional)</Label>
                <Select
                  value={offerForm.onBehalfOfPlaceholderId}
                  onValueChange={(v) => setOfferForm({ ...offerForm, onBehalfOfPlaceholderId: v === "self" ? "" : v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Myself" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Myself</SelectItem>
                    {placeholders.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.displayName}{p.relationship ? ` — ${p.relationship}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="offer-amount">Amount ($) <span className="text-destructive">*</span></Label>
              <Input
                id="offer-amount"
                type="number"
                placeholder="0.00"
                value={offerForm.amount}
                onChange={(e) => setOfferForm({ ...offerForm, amount: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type of support</Label>
              <Select value={offerForm.contributionType} onValueChange={(v) => setOfferForm({ ...offerForm, contributionType: v as typeof offerForm.contributionType })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loan">Loan (return expected)</SelectItem>
                  <SelectItem value="gift">Gift (no return needed)</SelectItem>
                  <SelectItem value="installment">Installment</SelectItem>
                  <SelectItem value="pledge">Pledge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-note">A kind word (optional)</Label>
              <Textarea
                id="offer-note"
                placeholder="Leave a warm message..."
                value={offerForm.note}
                onChange={(e) => setOfferForm({ ...offerForm, note: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOfferOpen(false)} className="rounded-full">Cancel</Button>
            <Button onClick={handleOfferSupport} disabled={createContribution.isPending} className="rounded-full">
              {createContribution.isPending ? "Offering..." : "Offer support"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Support Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Return support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-muted-foreground text-sm">Every bit returned helps keep the circle strong. Return what you can, when you can.</p>
            <div className="space-y-1.5">
              <Label htmlFor="return-amount">Amount ($) <span className="text-destructive">*</span></Label>
              <Input
                id="return-amount"
                type="number"
                placeholder="0.00"
                value={returnForm.amount}
                onChange={(e) => setReturnForm({ ...returnForm, amount: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="return-note">A note (optional)</Label>
              <Textarea
                id="return-note"
                placeholder="Thank you..."
                value={returnForm.note}
                onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Attach proof (optional)</Label>
              {returnProofFile ? (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{returnProofFile.name}</span>
                  <button className="text-muted-foreground hover:text-destructive transition-colors" onClick={() => setReturnProofFile(null)}>Remove</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors text-sm text-muted-foreground">
                  <Upload className="w-4 h-4" />
                  <span>Choose a receipt or screenshot</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={(e) => setReturnProofFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReturnOpen(false)} className="rounded-full">Cancel</Button>
            <Button onClick={handleReturnSupport} disabled={createRepayment.isPending} className="rounded-full" variant="secondary">
              {createRepayment.isPending ? "Logging..." : "Log return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
