import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import jsQR from "jsqr";
import { colors } from "../theme";
import { AppText } from "./ui";
import type { QrScannerProps } from "./QrScanner";

/** Frames analysed per second: enough to feel instant, light on the battery. */
const SCAN_INTERVAL_MS = 200;
/** Frames are downscaled before decoding: QR codes stay readable, decoding stays fast. */
const MAX_FRAME_SIDE = 640;

/**
 * Web counterpart of QrScanner.tsx: getUserMedia preview, frames decoded with
 * jsQR (Safari has no BarcodeDetector). Needs HTTPS, like geolocation.
 */
export function QrScanner({ onScan }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const scan = () => {
      const video = videoRef.current;
      if (!video || !context || video.readyState < video.HAVE_CURRENT_DATA) return;
      const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(data, width, height, { inversionAttempts: "dontInvert" });
      if (code?.data) onScanRef.current(code.data);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Ce navigateur ne donne pas accès à la caméra (il faut une page en https).");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        const denied = (err as DOMException).name === "NotAllowedError";
        setError(
          denied
            ? "Accès à la caméra refusé. Autorise-le dans les réglages du navigateur pour scanner."
            : "Impossible d'ouvrir la caméra.",
        );
        return;
      }
      if (cancelled || !videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => undefined);
      timer = setInterval(scan, SCAN_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return (
      <View style={[styles.fill, styles.denied]}>
        <AppText variant="body" color={colors.onNight} style={styles.center}>
          {error}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {/* playsInline: without it iOS Safari opens the stream in its fullscreen player. */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.night, overflow: "hidden" },
  denied: { alignItems: "center", justifyContent: "center", padding: 24 },
  center: { textAlign: "center" },
});
