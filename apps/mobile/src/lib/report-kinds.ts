import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { MapReportKind } from "@orbit/shared";

interface ReportKindMeta {
  label: string;
  /** Used in sentences: "Ada signale {phrase}". */
  phrase: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  color: string;
  hint: string;
}

/** How each kind of map report looks and reads, everywhere in the app. */
export const REPORT_KINDS: Record<MapReportKind, ReportKindMeta> = {
  danger: { label: "Danger", phrase: "un danger", icon: "warning", color: "#EF4444", hint: "Visible 4 h" },
  accident: { label: "Accident", phrase: "un accident", icon: "car", color: "#F97316", hint: "Visible 2 h" },
  traffic: { label: "Bouchon", phrase: "un bouchon", icon: "speedometer", color: "#EAB308", hint: "Visible 1 h" },
  roadwork: { label: "Travaux", phrase: "des travaux", icon: "construct", color: "#8B5CF6", hint: "Visible 7 jours" },
  closed: { label: "Route barrée", phrase: "une route barrée", icon: "remove-circle", color: "#0EA5E9", hint: "Visible 24 h" },
  other: { label: "Autre", phrase: "quelque chose", icon: "chatbubble-ellipses", color: "#64748B", hint: "Visible 6 h" },
};

export const REPORT_KIND_ORDER: MapReportKind[] = ["danger", "accident", "traffic", "roadwork", "closed", "other"];
