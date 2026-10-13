import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SPOT_CATEGORIES, type Spot } from "@orbit/shared";
import {
  useAddSpotComment,
  useDeleteSpot,
  useSpot,
  useToggleLikeSpot,
  useToggleSaveSpot,
} from "../../hooks/useSpots";
import { useNow } from "../../hooks/useNow";
import { useAddress } from "../../hooks/useAddress";
import { formatRelativeTime } from "../../lib/member-display";
import { colors, radius, shadows } from "../../theme";
import { AppText, Button, IconButton, PressableScale, Sheet } from "../ui";

export function SpotSheet({
  spot,
  myId,
  onClose,
  onNavigate,
}: {
  spot: Spot | null;
  myId: string | undefined;
  onClose: () => void;
  onNavigate?: (spot: Spot) => void;
}) {
  const [shown, setShown] = useState(spot);
  useEffect(() => {
    if (spot) setShown(spot);
  }, [spot]);

  return (
    <Sheet visible={spot != null} onClose={onClose}>
      {shown && (
        <SpotSheetContent
          spotInitial={shown}
          myId={myId}
          onClose={onClose}
          onNavigate={onNavigate}
        />
      )}
    </Sheet>
  );
}

function SpotSheetContent({
  spotInitial,
  myId,
  onClose,
  onNavigate,
}: {
  spotInitial: Spot;
  myId: string | undefined;
  onClose: () => void;
  onNavigate?: (spot: Spot) => void;
}) {
  const now = useNow();
  const { data: spotDetail } = useSpot(spotInitial.id);
  const spot = spotDetail ?? spotInitial;

  const toggleLike = useToggleLikeSpot();
  const toggleSave = useToggleSaveSpot();
  const addComment = useAddSpotComment();
  const deleteSpot = useDeleteSpot();

  const [commentText, setCommentText] = useState("");
  const fallbackAddress = useAddress(spot.latitude, spot.longitude);
  const displayAddress = spot.address || fallbackAddress?.full;

  const meta = SPOT_CATEGORIES[spot.category] ?? SPOT_CATEGORIES.secret_place;
  const isMine = spot.createdById === myId;

  const handleLike = () => {
    toggleLike.mutate(spot.id);
  };

  const handleSave = () => {
    toggleSave.mutate(spot.id);
  };

  const handleAddComment = () => {
    const text = commentText.trim();
    if (!text) return;
    addComment.mutate(
      { spotId: spot.id, message: text },
      {
        onSuccess: () => setCommentText(""),
        onError: (err) => Alert.alert("Erreur", (err as Error).message),
      },
    );
  };

  const handleDelete = () => {
    Alert.alert("Supprimer le spot", "Es-tu sûr de vouloir retirer ce spot ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          deleteSpot.mutate(spot.id, {
            onSuccess: onClose,
            onError: (err) => Alert.alert("Erreur", (err as Error).message),
          });
        },
      },
    ]);
  };

  const handleOpenExternalMap = () => {
    const scheme = Platform.select({
      ios: `maps:0,0?q=${spot.latitude},${spot.longitude}(${encodeURIComponent(spot.title)})`,
      android: `geo:0,0?q=${spot.latitude},${spot.longitude}(${encodeURIComponent(spot.title)})`,
      default: `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`,
    });
    void Linking.openURL(scheme);
  };

  return (
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
          <View style={[styles.categoryIcon, { backgroundColor: meta.color }]}>
            <Ionicons
              name={meta.icon as keyof typeof Ionicons.glyphMap}
              size={26}
              color={colors.onNight}
            />
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.categoryBadgeRow}>
              <View style={[styles.badge, { backgroundColor: meta.color + "20" }]}>
                <AppText
                  variant="caption"
                  style={[styles.badgeText, { color: meta.color }]}
                >
                  {meta.label}
                </AppText>
              </View>
              <View style={styles.visibilityBadge}>
                <Ionicons
                  name={spot.visibility === "public" ? "globe-outline" : "lock-closed-outline"}
                  size={12}
                  color={colors.muted}
                />
                <AppText variant="caption" color={colors.muted}>
                  {spot.visibility === "public"
                    ? "Public"
                    : spot.circleName
                    ? spot.circleName
                    : "Cercle privé"}
                </AppText>
              </View>
            </View>
            <AppText variant="title" style={styles.title}>
              {spot.title}
            </AppText>
          </View>
        </View>

        {/* Address & Creator */}
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={colors.muted} />
          <AppText variant="caption" color={colors.ink2} numberOfLines={1} style={styles.flex}>
            {displayAddress ?? "Coordonnées GPS"}
          </AppText>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="person-outline" size={14} color={colors.muted} />
          <AppText variant="caption" color={colors.ink2} style={styles.flex}>
            Partagé par {isMine ? "toi" : spot.creatorDisplayName} •{" "}
            {formatRelativeTime(spot.createdAt, now)}
          </AppText>
        </View>

        {/* Description / Secret Tip */}
        {spot.description ? (
          <View style={styles.descriptionBox}>
            <View style={styles.tipHeader}>
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <AppText variant="caption" color={colors.primary} style={{ fontWeight: "700" }}>
                Conseil & Astuce secrète
              </AppText>
            </View>
            <AppText variant="body" color={colors.ink}>
              {spot.description}
            </AppText>
          </View>
        ) : null}

        {/* Tags */}
        {spot.tags && spot.tags.length > 0 ? (
          <View style={styles.tagsRow}>
            {spot.tags.map((tag, idx) => (
              <View key={idx} style={styles.tagPill}>
                <AppText variant="caption" color={colors.ink2}>
                  #{tag}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {/* Primary Action Buttons */}
        <View style={styles.actionsBar}>
          <Button
            style={styles.flex}
            icon="navigate"
            label="Y aller"
            onPress={() => {
              if (onNavigate) {
                onNavigate(spot);
              } else {
                handleOpenExternalMap();
              }
            }}
          />

          <PressableScale
            style={[
              styles.iconBtn,
              spot.isLikedByMe && { backgroundColor: "#FFE5EC", borderColor: "#FF4D6D" },
            ]}
            onPress={handleLike}
            scaleTo={0.88}
          >
            <Ionicons
              name={spot.isLikedByMe ? "heart" : "heart-outline"}
              size={22}
              color={spot.isLikedByMe ? "#FF4D6D" : colors.ink}
            />
            <AppText
              variant="caption"
              color={spot.isLikedByMe ? "#FF4D6D" : colors.ink}
              style={{ fontWeight: "700", marginLeft: 4 }}
            >
              {spot.likesCount}
            </AppText>
          </PressableScale>

          <PressableScale
            style={[
              styles.iconBtn,
              spot.isSavedByMe && { backgroundColor: colors.primarySoft, borderColor: colors.primary },
            ]}
            onPress={handleSave}
            scaleTo={0.88}
          >
            <Ionicons
              name={spot.isSavedByMe ? "bookmark" : "bookmark-outline"}
              size={22}
              color={spot.isSavedByMe ? colors.primary : colors.ink}
            />
          </PressableScale>

          {isMine && (
            <PressableScale
              style={[styles.iconBtn, styles.deleteBtn]}
              onPress={handleDelete}
              scaleTo={0.88}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </PressableScale>
          )}
        </View>

        {/* Comments & Community Tips */}
        <View style={styles.commentsSection}>
          <View style={styles.commentsTitleRow}>
            <Ionicons name="chatbubbles-outline" size={18} color={colors.ink} />
            <AppText variant="headline" style={{ fontWeight: "700" }}>
              Avis & Astuces ({spot.comments?.length ?? spot.commentsCount})
            </AppText>
          </View>

          {spot.comments && spot.comments.length > 0 ? (
            <View style={styles.commentsList}>
              {spot.comments.map((comment) => (
                <View key={comment.id} style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <AppText variant="caption" style={{ fontWeight: "700" }}>
                      {comment.displayName}
                    </AppText>
                    <AppText variant="caption" color={colors.muted}>
                      {formatRelativeTime(comment.createdAt, now)}
                    </AppText>
                  </View>
                  <AppText variant="body" color={colors.ink2}>
                    {comment.message}
                  </AppText>
                </View>
              ))}
            </View>
          ) : (
            <AppText variant="caption" color={colors.muted} style={styles.noCommentsText}>
              Aucun avis pour l'instant. Sois le premier à partager une astuce !
            </AppText>
          )}

          {/* Add Comment Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Ajouter une astuce ou un conseil..."
              placeholderTextColor={colors.muted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <IconButton
              icon="send"
              size={38}
              background={commentText.trim() && !addComment.isPending ? colors.primary : colors.bg}
              color={commentText.trim() && !addComment.isPending ? colors.onNight : colors.muted}
              accessibilityLabel="Envoyer le commentaire"
              onPress={handleAddComment}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { gap: 14, paddingBottom: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
  headerInfo: { flex: 1, gap: 4 },
  categoryBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
  visibilityBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  title: { fontSize: 18, lineHeight: 22 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  descriptionBox: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tipHeader: { flexDirection: "row", alignItems: "center", gap: 4 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagPill: {
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionsBar: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  iconBtn: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    borderColor: "#FEE2E2",
    backgroundColor: "#FEF2F2",
  },
  commentsSection: {
    marginTop: 8,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  commentsTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentsList: { gap: 8 },
  commentItem: {
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    gap: 2,
  },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  noCommentsText: { fontStyle: "italic", paddingVertical: 4 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 90,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    fontSize: 14,
  },
});
