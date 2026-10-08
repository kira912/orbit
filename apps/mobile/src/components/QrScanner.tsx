import { useEffect } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { colors } from "../theme";
import { AppText, Button } from "./ui";

export interface QrScannerProps {
  /** Called with each QR code's text; may fire repeatedly while it stays in view. */
  onScan: (data: string) => void;
}

/** Back camera preview that reports QR codes (native: expo-camera; web: see QrScanner.web.tsx). */
export function QrScanner({ onScan }: QrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  if (!permission) return <View style={styles.fill} />;
  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.denied]}>
        <AppText variant="body" color={colors.onNight} style={styles.center}>
          Orbit a besoin de la caméra pour scanner le QR code.
        </AppText>
        <Button
          variant="light"
          label={permission.canAskAgain ? "Autoriser la caméra" : "Ouvrir les réglages"}
          onPress={() => (permission.canAskAgain ? void requestPermission() : void Linking.openSettings())}
        />
      </View>
    );
  }

  return (
    <CameraView
      style={styles.fill}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      onBarcodeScanned={({ data }) => onScan(data)}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.night },
  denied: { alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  center: { textAlign: "center" },
});
