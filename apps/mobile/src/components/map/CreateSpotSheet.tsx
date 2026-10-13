import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  SPOT_CATEGORIES,
  type SpotCategory,
  type SpotVisibility,
} from "@orbit/shared";
import { useCreateSpot } from "../../hooks/useSpots";
import { useCircles } from "../../hooks/useCircles";
import { useAddress } from "../../hooks/useAddress";
import { colors, radius, shadows } from "../../theme";
import { AppText, Button, PressableScale, Sheet } from "../ui";

interface CreateSpotSheetProps {
  visible: boolean;
  coordinates: [number, number] | null; // [longitude, latitude]
  circleId: string | null;
  onClose: () => void;
}

const CATEGORIES_LIST: SpotCategory[] = [
  "secret_place",
  "viewpoint",
  "photo",
  "cafe_bar",
  "nature",
  "culture",
  "food",
  "activity",
  "chill",
];

export function CreateSpotSheet({
  visible,
  coordinates,
  circleId,
  onClose,
}: CreateSpotSheetProps) {
  const { data: circles } = useCircles();
  const createSpot = useCreateSpot();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SpotCategory>("secret_place");
  const [visibility, setVisibility] = useState<SpotVisibility>("circle");
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(circleId);
  const [tagsInput, setTagsInput] = useState("");

  const latitude = coordinates ? coordinates[1] : 48.8566;
  const longitude = coordinates ? coordinates[0] : 2.3522;
  const address = useAddress(latitude, longitude);

  const activeCircleId = selectedCircleId ?? circleId ?? (circles && circles[0]?.id) ?? null;

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert("Titre requis", "Donne un nom à ce spot pour le partager.");
      return;
    }

    if (visibility === "circle" && !activeCircleId) {
      Alert.alert("Cercle requis", "Sélectionne un cercle avec lequel partager ce spot.");
      return;
    }

    const tags = tagsInput
      .split(/[\s,#,;]+/)
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    createSpot.mutate(
      {
        title: trimmedTitle,
        description: description.trim() || undefined,
        category,
        visibility,
        circleId: visibility === "circle" ? activeCircleId ?? undefined : undefined,
        latitude,
        longitude,
        address: address?.full ?? undefined,
        tags,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setTagsInput("");
          onClose();
        },
        onError: (err) => {
          Alert.alert("Erreur", (err as Error).message);
        },
      },
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={60}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="sparkles" size={24} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <AppText variant="title">Partager une pépite</AppText>
              <AppText variant="caption" color={colors.muted}>
                {address?.full ?? "Lieu sélectionné sur la carte"}
              </AppText>
            </View>
          </View>

          {/* Title */}
          <View style={styles.field}>
            <AppText variant="caption" style={styles.label}>
              Nom du spot *
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="Ex: Rooftop secret, Coucher de soleil..."
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Category Picker */}
          <View style={styles.field}>
            <AppText variant="caption" style={styles.label}>
              Catégorie
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesRow}
            >
              {CATEGORIES_LIST.map((catKey) => {
                const item = SPOT_CATEGORIES[catKey];
                const selected = category === catKey;
                return (
                  <PressableScale
                    key={catKey}
                    style={[
                      styles.categoryCard,
                      selected && {
                        backgroundColor: item.color + "18",
                        borderColor: item.color,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => setCategory(catKey)}
                    scaleTo={0.94}
                  >
                    <View
                      style={[
                        styles.catIconWrap,
                        { backgroundColor: selected ? item.color : colors.surfaceAlt },
                      ]}
                    >
                      <Ionicons
                        name={item.icon as keyof typeof Ionicons.glyphMap}
                        size={18}
                        color={selected ? colors.onNight : colors.ink}
                      />
                    </View>
                    <AppText
                      variant="caption"
                      style={[
                        styles.catLabel,
                        selected && { color: item.color, fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </AppText>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>

          {/* Description & Secret tip */}
          <View style={styles.field}>
            <AppText variant="caption" style={styles.label}>
              Conseil ou astuce secrète
            </AppText>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ex: Meilleur angle pour les photos, passer par la petite porte au fond..."
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              maxLength={1000}
            />
          </View>

          {/* Tags */}
          <View style={styles.field}>
            <AppText variant="caption" style={styles.label}>
              Tags (optionnel)
            </AppText>
            <TextInput
              style={styles.input}
              placeholder="Ex: vue, sunset, calme, insolite (séparés par des virgules)"
              placeholderTextColor={colors.muted}
              value={tagsInput}
              onChangeText={setTagsInput}
              maxLength={100}
            />
          </View>

          {/* Visibility Selector */}
          <View style={styles.field}>
            <AppText variant="caption" style={styles.label}>
              Visibilité
            </AppText>
            <View style={styles.visibilityRow}>
              <PressableScale
                style={[
                  styles.visibilityOption,
                  visibility === "circle" && styles.visibilityActive,
                ]}
                onPress={() => setVisibility("circle")}
                scaleTo={0.96}
              >
                <Ionicons
                  name="people"
                  size={18}
                  color={visibility === "circle" ? colors.primary : colors.muted}
                />
                <View style={styles.flex}>
                  <AppText
                    variant="caption"
                    style={{ fontWeight: visibility === "circle" ? "700" : "500" }}
                  >
                    Mon cercle privé
                  </AppText>
                  <AppText variant="caption" color={colors.muted} style={{ fontSize: 11 }}>
                    Visible uniquement par les membres
                  </AppText>
                </View>
              </PressableScale>

              <PressableScale
                style={[
                  styles.visibilityOption,
                  visibility === "public" && styles.visibilityActive,
                ]}
                onPress={() => setVisibility("public")}
                scaleTo={0.96}
              >
                <Ionicons
                  name="globe"
                  size={18}
                  color={visibility === "public" ? colors.primary : colors.muted}
                />
                <View style={styles.flex}>
                  <AppText
                    variant="caption"
                    style={{ fontWeight: visibility === "public" ? "700" : "500" }}
                  >
                    Public (Communauté)
                  </AppText>
                  <AppText variant="caption" color={colors.muted} style={{ fontSize: 11 }}>
                    Visible par tous les explorateurs
                  </AppText>
                </View>
              </PressableScale>
            </View>
          </View>

          {/* Submit */}
          <Button
            label="Publier cette pépite"
            icon="sparkles"
            loading={createSpot.isPending}
            onPress={handleSubmit}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: 14, paddingBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { gap: 6 },
  label: { fontWeight: "700", color: colors.ink2 },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  categoriesRow: { gap: 8, paddingVertical: 2 },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  catIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  catLabel: { fontSize: 12, fontWeight: "600" },
  visibilityRow: { gap: 8 },
  visibilityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  visibilityActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
});
