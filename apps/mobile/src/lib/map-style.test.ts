import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { applyPastelTheme } from "./map-style";

const baseStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "rgb(242,243,240)" } },
    { id: "water", type: "fill", source: "openmaptiles", paint: { "fill-color": "grey", "fill-antialias": true } },
    { id: "custom", type: "line", source: "openmaptiles", paint: { "line-color": "red" } },
  ],
};

describe("applyPastelTheme", () => {
  it("recolors known layers and keeps their other paint properties", () => {
    const [background, water] = applyPastelTheme(baseStyle).layers;
    expect(background.paint).toEqual({ "background-color": "#f6f3ee" });
    expect(water.paint).toEqual({ "fill-color": "#bcdcee", "fill-antialias": true });
  });

  it("leaves unknown layers and the input untouched", () => {
    const themed = applyPastelTheme(baseStyle);
    expect(themed.layers[2]).toBe(baseStyle.layers[2]);
    expect(baseStyle.layers[1].paint).toEqual({ "fill-color": "grey", "fill-antialias": true });
  });
});
