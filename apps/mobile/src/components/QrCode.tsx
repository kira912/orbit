import { useMemo } from "react";
import { View } from "react-native";
import QRCode from "qrcode";

interface QrCodeProps {
  value: string;
  size: number;
  color?: string;
  background?: string;
}

/** Quiet zone around the code, in modules: scanners need it to find the edges. */
const MARGIN = 2;

/**
 * A QR code drawn with plain Views (no SVG/native module needed): one View
 * per horizontal run of dark modules, which keeps it to a few hundred views.
 */
export function QrCode({ value, size, color = "#0B1020", background = "#FFFFFF" }: QrCodeProps) {
  const { runs, count } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = modules.size;
    const found: { row: number; col: number; length: number }[] = [];
    for (let row = 0; row < n; row++) {
      let start = -1;
      for (let col = 0; col <= n; col++) {
        const dark = col < n && modules.get(row, col);
        if (dark && start < 0) start = col;
        if (!dark && start >= 0) {
          found.push({ row, col: start, length: col - start });
          start = -1;
        }
      }
    }
    return { runs: found, count: n + MARGIN * 2 };
  }, [value]);

  const cell = size / count;
  return (
    <View
      style={{ width: size, height: size, backgroundColor: background }}
      accessibilityRole="image"
      accessibilityLabel="QR code d'invitation"
    >
      {runs.map(({ row, col, length }) => (
        <View
          key={`${row}-${col}`}
          style={{
            position: "absolute",
            top: (row + MARGIN) * cell,
            left: (col + MARGIN) * cell,
            // Slight overlap hides hairline seams between adjacent runs.
            width: length * cell + 0.5,
            height: cell + 0.5,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}
