import { z } from "zod";
import { geoPointSchema } from "./location";

export const spotCategorySchema = z.enum([
  "viewpoint",
  "photo",
  "secret_place",
  "cafe_bar",
  "nature",
  "culture",
  "food",
  "activity",
  "chill",
]);
export type SpotCategory = z.infer<typeof spotCategorySchema>;

export const spotVisibilitySchema = z.enum(["public", "circle"]);
export type SpotVisibility = z.infer<typeof spotVisibilitySchema>;

export const SPOT_CATEGORIES: Record<
  SpotCategory,
  { label: string; icon: string; description: string; color: string }
> = {
  secret_place: {
    label: "Pépite secrète",
    icon: "sparkles",
    description: "Endroit méconnu ou insolite",
    color: "#8B5CF6",
  },
  viewpoint: {
    label: "Vue & Sunset",
    icon: "sunny",
    description: "Panorama, coucher de soleil",
    color: "#F59E0B",
  },
  photo: {
    label: "Spot Photo",
    icon: "camera",
    description: "Cadre parfait pour photos",
    color: "#EC4899",
  },
  cafe_bar: {
    label: "Café & Bar",
    icon: "wine",
    description: "Rooftop, café sympa ou bar caché",
    color: "#3B82F6",
  },
  nature: {
    label: "Coin Nature",
    icon: "leaf",
    description: "Parc, lac, verdure, calme",
    color: "#10B981",
  },
  culture: {
    label: "Street Art & Culture",
    icon: "color-palette",
    description: "Fresque, monument, lieu d'art",
    color: "#6366F1",
  },
  food: {
    label: "Bonne adresse",
    icon: "restaurant",
    description: "Street food, pépite gourmande",
    color: "#EF4444",
  },
  activity: {
    label: "Activité & Fun",
    icon: "bicycle",
    description: "Skatepark, sport, jeux",
    color: "#06B6D4",
  },
  chill: {
    label: "Spot Chill",
    icon: "bonfire",
    description: "Pique-nique, repos, lecture",
    color: "#14B8A6",
  },
};

export const spotCommentSchema = z.object({
  id: z.string().uuid(),
  spotId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  pictureUrl: z.string().nullable().optional(),
  message: z.string(),
  createdAt: z.coerce.date(),
});
export type SpotComment = z.infer<typeof spotCommentSchema>;

export const spotSchema = geoPointSchema.extend({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  category: spotCategorySchema,
  visibility: spotVisibilitySchema,
  address: z.string().nullable().optional(),
  tags: z.array(z.string()),
  createdById: z.string().uuid(),
  creatorDisplayName: z.string(),
  creatorPictureUrl: z.string().nullable().optional(),
  circleId: z.string().uuid().nullable().optional(),
  circleName: z.string().nullable().optional(),
  likesCount: z.number().int().nonnegative(),
  commentsCount: z.number().int().nonnegative(),
  isLikedByMe: z.boolean(),
  isSavedByMe: z.boolean(),
  comments: z.array(spotCommentSchema).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Spot = z.infer<typeof spotSchema>;

export const createSpotInputSchema = geoPointSchema.extend({
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  category: spotCategorySchema.default("secret_place"),
  visibility: spotVisibilitySchema.default("circle"),
  circleId: z.string().uuid().optional(),
  address: z.string().trim().max(200).optional(),
  tags: z.array(z.string().trim().max(30)).max(10).default([]),
});
export type CreateSpotInput = z.infer<typeof createSpotInputSchema>;

export const addSpotCommentInputSchema = z.object({
  message: z.string().trim().min(1).max(500),
});
export type AddSpotCommentInput = z.infer<typeof addSpotCommentInputSchema>;

export const listSpotsQuerySchema = z.object({
  circleId: z.string().uuid().optional(),
  category: spotCategorySchema.optional(),
  visibility: spotVisibilitySchema.optional(),
  search: z.string().trim().optional(),
  savedOnly: z.coerce.boolean().optional(),
  mySpotsOnly: z.coerce.boolean().optional(),
});
export type ListSpotsQuery = z.infer<typeof listSpotsQuerySchema>;

export const spotsUpdatedSchema = z.object({
  circleId: z.string().uuid().nullable().optional(),
  spotId: z.string().uuid(),
  change: z.enum(["created", "liked", "commented", "deleted"]),
  userId: z.string().uuid(),
  displayName: z.string(),
  title: z.string(),
});
export type SpotsUpdated = z.infer<typeof spotsUpdatedSchema>;
