import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, View } from "react-native";
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
import {
  AppText,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Pill,
  Row,
} from "@/components/UI";
import { useColors } from "@/hooks/useColors";

export function ProfileCapacityEditor() {
  const c = useColors();
  const queryClient = useQueryClient();
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
  const busy = createSkill.isPending || updateSkill.isPending ||
    deleteSkill.isPending || createResource.isPending ||
    updateResource.isPending || deleteResource.isPending;

  function refreshCapacity() {
    void queryClient.invalidateQueries({ queryKey: getListMySkillsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListMyResourcesQueryKey() });
    void queryClient.invalidateQueries({
      predicate: (query) => {
        const path = query.queryKey[0];
        return (
          typeof path === "string" &&
          path.startsWith("/api/circles/") &&
          (path.endsWith("/members") || path.endsWith("/skills-search"))
        );
      },
    });
  }

  function showError(kind: "skill" | "resource") {
    Alert.alert(
      `Could not save ${kind}`,
      `Check for a duplicate ${kind} or try again.`,
    );
  }

  function addSkill() {
    const label = skillDraft.trim();
    if (!label) return;
    if (skills.length >= 30) {
      Alert.alert("Skill limit reached", "You can list up to 30 skills.");
      return;
    }
    createSkill.mutate(
      { data: { label } },
      {
        onSuccess: () => {
          setSkillDraft("");
          refreshCapacity();
        },
        onError: () => showError("skill"),
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
        onError: () => showError("skill"),
      },
    );
  }

  function removeSkill(skillId: number, label: string) {
    Alert.alert("Remove skill?", `Remove ${label} from your profile?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          deleteSkill.mutate(
            { skillId },
            {
              onSuccess: refreshCapacity,
              onError: () => showError("skill"),
            },
          ),
      },
    ]);
  }

  function addResource() {
    const label = resourceDraft.trim();
    if (!label) return;
    if (resources.length >= 30) {
      Alert.alert("Resource limit reached", "You can list up to 30 resources.");
      return;
    }
    createResource.mutate(
      { data: { label, isAvailable: true } },
      {
        onSuccess: () => {
          setResourceDraft("");
          refreshCapacity();
        },
        onError: () => showError("resource"),
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
        onError: () => showError("resource"),
      },
    );
  }

  function removeResource(resourceId: number, label: string) {
    Alert.alert("Remove resource?", `Remove ${label} from your profile?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          deleteResource.mutate(
            { resourceId },
            {
              onSuccess: refreshCapacity,
              onError: () => showError("resource"),
            },
          ),
      },
    ]);
  }

  return (
    <Card testID="profile-capacity-editor" style={{ marginBottom: 16 }}>
      <AppText variant="title">Skills & resources</AppText>
      <AppText
        variant="caption"
        color={c.mutedForeground}
        style={{ marginTop: 4, marginBottom: 18 }}
      >
        People in circles with you can see these.
      </AppText>

      {(skillsQuery.isLoading || resourcesQuery.isLoading) ? (
        <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />
      ) : null}
      {(skillsQuery.isError || resourcesQuery.isError) ? (
        <View style={{ marginBottom: 14 }}>
          <AppText color={c.destructive}>Could not load your skills or resources.</AppText>
          <Button
            title="Try again"
            variant="outline"
            size="sm"
            onPress={() => {
              void skillsQuery.refetch();
              void resourcesQuery.refetch();
            }}
            style={{ marginTop: 8 }}
          />
        </View>
      ) : null}

      <Field label="Skills">
        <AppText variant="caption" color={c.mutedForeground} style={{ marginBottom: 8 }}>
          Examples: CPR, Spanish, carpentry
        </AppText>
        <Row gap={8} align="center">
          <Input
            value={skillDraft}
            onChangeText={setSkillDraft}
            placeholder="Add a skill"
            maxLength={80}
            testID="input-member-skill"
            style={{ flex: 1 }}
          />
          <IconButton
            icon="plus"
            color={c.primary}
            onPress={addSkill}
            accessibilityLabel="Add skill"
            testID="button-add-member-skill"
          />
        </Row>
      </Field>
      {skills.length === 0 ? (
        <AppText variant="caption" color={c.mutedForeground} style={{ marginBottom: 14 }}>
          No skills added yet.
        </AppText>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {skills.map((skill) => (
            <View
              key={skill.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                borderRadius: 999,
                backgroundColor: c.primarySoft,
                paddingLeft: 10,
                paddingRight: 4,
                paddingVertical: 3,
              }}
            >
              {editingSkillId === skill.id ? (
                <>
                  <Input
                    value={editingSkillLabel}
                    onChangeText={setEditingSkillLabel}
                    maxLength={80}
                    accessibilityLabel="Edit skill name"
                    style={{ minHeight: 36, width: 140, borderRadius: 999, paddingVertical: 6 }}
                  />
                  <IconButton
                    icon="check"
                    onPress={() => saveSkill(skill.id)}
                    accessibilityLabel="Save skill"
                  />
                  <IconButton
                    icon="x"
                    onPress={() => setEditingSkillId(null)}
                    accessibilityLabel="Cancel skill edit"
                  />
                </>
              ) : (
                <>
                  <Pill label={skill.label} bg="transparent" fg={c.primary} />
                  <IconButton
                    icon="edit-2"
                    size={34}
                    onPress={() => {
                      setEditingSkillId(skill.id);
                      setEditingSkillLabel(skill.label);
                    }}
                    accessibilityLabel={`Edit ${skill.label}`}
                  />
                  <IconButton
                    icon="trash-2"
                    size={34}
                    color={c.destructive}
                    onPress={() => removeSkill(skill.id, skill.label)}
                    accessibilityLabel={`Remove ${skill.label}`}
                  />
                </>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16 }}>
        <Field label="Resources">
          <AppText variant="caption" color={c.mutedForeground} style={{ marginBottom: 8 }}>
            Examples: truck, guest room, tools
          </AppText>
          <Row gap={8} align="center">
            <Input
              value={resourceDraft}
              onChangeText={setResourceDraft}
              placeholder="Add a resource"
              maxLength={80}
              testID="input-member-resource"
              style={{ flex: 1 }}
            />
            <IconButton
              icon="plus"
              color={c.primary}
              onPress={addResource}
              accessibilityLabel="Add resource"
              testID="button-add-member-resource"
            />
          </Row>
        </Field>
        {resources.length === 0 ? (
          <AppText variant="caption" color={c.mutedForeground}>
            No resources added yet.
          </AppText>
        ) : (
          <View style={{ gap: 8 }}>
            {resources.map((resource) => (
              <View
                key={resource.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: c.border,
                  borderRadius: 14,
                  padding: 10,
                }}
              >
                {editingResourceId === resource.id ? (
                  <>
                    <Input
                      value={editingResourceLabel}
                      onChangeText={setEditingResourceLabel}
                      maxLength={80}
                      accessibilityLabel="Edit resource name"
                      style={{ flex: 1 }}
                    />
                    <IconButton
                      icon="check"
                      onPress={() => saveResource(resource.id)}
                      accessibilityLabel="Save resource"
                    />
                    <IconButton
                      icon="x"
                      onPress={() => setEditingResourceId(null)}
                      accessibilityLabel="Cancel resource edit"
                    />
                  </>
                ) : (
                  <>
                    <View style={{ flex: 1 }}>
                      <AppText weight="medium" numberOfLines={1}>{resource.label}</AppText>
                      <AppText variant="caption" color={c.mutedForeground}>
                        {resource.isAvailable ? "Available to share" : "Currently unavailable"}
                      </AppText>
                    </View>
                    <Switch
                      value={resource.isAvailable}
                      onValueChange={(isAvailable) =>
                        updateResource.mutate(
                          { resourceId: resource.id, data: { isAvailable } },
                          {
                            onSuccess: refreshCapacity,
                            onError: () => showError("resource"),
                          },
                        )
                      }
                      trackColor={{ true: c.primary, false: c.muted }}
                      accessibilityLabel={`Availability for ${resource.label}`}
                      testID={`switch-resource-${resource.id}`}
                    />
                    <IconButton
                      icon="edit-2"
                      size={36}
                      onPress={() => {
                        setEditingResourceId(resource.id);
                        setEditingResourceLabel(resource.label);
                      }}
                      accessibilityLabel={`Edit ${resource.label}`}
                    />
                    <IconButton
                      icon="trash-2"
                      size={36}
                      color={c.destructive}
                      onPress={() => removeResource(resource.id, resource.label)}
                      accessibilityLabel={`Remove ${resource.label}`}
                    />
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
      {busy ? (
        <AppText variant="caption" color={c.mutedForeground} style={{ marginTop: 12 }}>
          Saving…
        </AppText>
      ) : null}
    </Card>
  );
}
