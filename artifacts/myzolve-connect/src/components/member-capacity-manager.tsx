import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListMyResourcesQueryKey,
  getListMySkillsQueryKey,
  useCreateMyResource,
  useCreateMySkill,
  useDeleteMyResource,
  useDeleteMySkill,
  useListMyResources,
  useListMySkills,
  useUpdateMyResource,
  useUpdateMySkill,
} from "@workspace/api-client-react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

function isCapacityQuery(query: { queryKey: readonly unknown[] }) {
  const path = query.queryKey[0];
  return (
    typeof path === "string" &&
    path.startsWith("/api/circles/") &&
    (path.endsWith("/members") || path.endsWith("/skills-search"))
  );
}

export function MemberCapacityManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const skillsQuery = useListMySkills();
  const resourcesQuery = useListMyResources();
  const createSkill = useCreateMySkill();
  const updateSkill = useUpdateMySkill();
  const deleteSkill = useDeleteMySkill();
  const createResource = useCreateMyResource();
  const updateResource = useUpdateMyResource();
  const deleteResource = useDeleteMyResource();
  const [skillDraft, setSkillDraft] = useState("");
  const [resourceDraft, setResourceDraft] = useState("");
  const [editingSkillId, setEditingSkillId] = useState<number | null>(null);
  const [editingSkillLabel, setEditingSkillLabel] = useState("");
  const [editingResourceId, setEditingResourceId] = useState<number | null>(null);
  const [editingResourceLabel, setEditingResourceLabel] = useState("");

  const skills = skillsQuery.data ?? [];
  const resources = resourcesQuery.data ?? [];
  const refreshing = createSkill.isPending || updateSkill.isPending ||
    deleteSkill.isPending || createResource.isPending ||
    updateResource.isPending || deleteResource.isPending;

  function refreshCapacity() {
    void queryClient.invalidateQueries({ queryKey: getListMySkillsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListMyResourcesQueryKey() });
    void queryClient.invalidateQueries({
      predicate: isCapacityQuery,
    });
  }

  function mutationError(kind: "skill" | "resource") {
    toast({
      title: `Could not save ${kind}`,
      description: `Check for a duplicate ${kind} or try again.`,
      variant: "destructive",
    });
  }

  function addSkill() {
    const label = skillDraft.trim();
    if (!label) return;
    createSkill.mutate(
      { data: { label } },
      {
        onSuccess: () => {
          setSkillDraft("");
          refreshCapacity();
        },
        onError: () => mutationError("skill"),
      },
    );
  }

  function saveSkill(skillId: number) {
    const label = editingSkillLabel.trim();
    if (!label) return;
    updateSkill.mutate(
      { skillId, data: { label } },
      {
        onSuccess: () => {
          setEditingSkillId(null);
          refreshCapacity();
        },
        onError: () => mutationError("skill"),
      },
    );
  }

  function removeSkill(skillId: number, label: string) {
    if (!window.confirm(`Remove “${label}” from your skills?`)) return;
    deleteSkill.mutate(
      { skillId },
      {
        onSuccess: refreshCapacity,
        onError: () => mutationError("skill"),
      },
    );
  }

  function addResource() {
    const label = resourceDraft.trim();
    if (!label) return;
    createResource.mutate(
      { data: { label, isAvailable: true } },
      {
        onSuccess: () => {
          setResourceDraft("");
          refreshCapacity();
        },
        onError: () => mutationError("resource"),
      },
    );
  }

  function saveResource(resourceId: number) {
    const label = editingResourceLabel.trim();
    if (!label) return;
    updateResource.mutate(
      { resourceId, data: { label } },
      {
        onSuccess: () => {
          setEditingResourceId(null);
          refreshCapacity();
        },
        onError: () => mutationError("resource"),
      },
    );
  }

  function removeResource(resourceId: number, label: string) {
    if (!window.confirm(`Remove “${label}” from your resources?`)) return;
    deleteResource.mutate(
      { resourceId },
      {
        onSuccess: refreshCapacity,
        onError: () => mutationError("resource"),
      },
    );
  }

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm" data-testid="member-capacity-manager">
      <CardHeader>
        <CardTitle>Skills & resources</CardTitle>
        <CardDescription>
          Share what you know and what you can lend. Only people in circles with you can see these.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-7">
        {(skillsQuery.isLoading || resourcesQuery.isLoading) && (
          <p className="text-sm text-muted-foreground">Loading your profile inventory…</p>
        )}
        {(skillsQuery.isError || resourcesQuery.isError) && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="text-destructive">Could not load your skills or resources.</p>
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 py-1"
              onClick={() => {
                void skillsQuery.refetch();
                void resourcesQuery.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        )}

        <section className="space-y-3" aria-labelledby="profile-skills-heading">
          <div>
            <h3 id="profile-skills-heading" className="font-semibold">Skills</h3>
            <p className="text-xs text-muted-foreground">Examples: CPR, Spanish, carpentry</p>
          </div>
          <div className="flex gap-2">
            <Input
              value={skillDraft}
              onChange={(event) => setSkillDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Add a skill"
              maxLength={80}
              data-testid="input-member-skill"
            />
            <Button
              type="button"
              onClick={addSkill}
              disabled={!skillDraft.trim() || skills.length >= 30 || createSkill.isPending}
              aria-label="Add skill"
              data-testid="button-add-member-skill"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add
            </Button>
          </div>
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <div key={skill.id} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                  {editingSkillId === skill.id ? (
                    <>
                      <Input
                        value={editingSkillLabel}
                        onChange={(event) => setEditingSkillLabel(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveSkill(skill.id);
                        }}
                        className="h-7 w-36 rounded-full px-2"
                        maxLength={80}
                        aria-label="Edit skill name"
                        data-testid={`input-edit-skill-${skill.id}`}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full"
                        onClick={() => saveSkill(skill.id)}
                        disabled={!editingSkillLabel.trim() || updateSkill.isPending}
                        aria-label="Save skill"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full"
                        onClick={() => setEditingSkillId(null)}
                        aria-label="Cancel skill edit"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge variant="secondary" className="bg-transparent px-0">{skill.label}</Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full"
                        onClick={() => {
                          setEditingSkillId(skill.id);
                          setEditingSkillLabel(skill.label);
                        }}
                        aria-label={`Edit ${skill.label}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full text-destructive"
                        onClick={() => removeSkill(skill.id, skill.label)}
                        disabled={refreshing}
                        aria-label={`Remove ${skill.label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 border-t border-border/60 pt-6" aria-labelledby="profile-resources-heading">
          <div>
            <h3 id="profile-resources-heading" className="font-semibold">Resources</h3>
            <p className="text-xs text-muted-foreground">Examples: truck, guest room, tools</p>
          </div>
          <div className="flex gap-2">
            <Input
              value={resourceDraft}
              onChange={(event) => setResourceDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addResource();
                }
              }}
              placeholder="Add a resource"
              maxLength={80}
              data-testid="input-member-resource"
            />
            <Button
              type="button"
              onClick={addResource}
              disabled={!resourceDraft.trim() || resources.length >= 30 || createResource.isPending}
              aria-label="Add resource"
              data-testid="button-add-member-resource"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add
            </Button>
          </div>
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resources added yet.</p>
          ) : (
            <div className="space-y-2">
              {resources.map((resource) => (
                <div key={resource.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                  {editingResourceId === resource.id ? (
                    <>
                      <Input
                        value={editingResourceLabel}
                        onChange={(event) => setEditingResourceLabel(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveResource(resource.id);
                        }}
                        className="h-9 flex-1 rounded-lg"
                        maxLength={80}
                        aria-label="Edit resource name"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => saveResource(resource.id)}
                        disabled={!editingResourceLabel.trim() || updateResource.isPending}
                        aria-label="Save resource"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingResourceId(null)}
                        aria-label="Cancel resource edit"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{resource.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {resource.isAvailable ? "Available to share" : "Currently unavailable"}
                        </p>
                      </div>
                      <Switch
                        checked={resource.isAvailable}
                        onCheckedChange={(isAvailable) =>
                          updateResource.mutate(
                            { resourceId: resource.id, data: { isAvailable } },
                            {
                              onSuccess: refreshCapacity,
                              onError: () => mutationError("resource"),
                            },
                          )
                        }
                        aria-label={`Availability for ${resource.label}`}
                        data-testid={`switch-resource-${resource.id}`}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingResourceId(resource.id);
                          setEditingResourceLabel(resource.label);
                        }}
                        aria-label={`Edit ${resource.label}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeResource(resource.id, resource.label)}
                        disabled={refreshing}
                        aria-label={`Remove ${resource.label}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
