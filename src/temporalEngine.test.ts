// Feature: secure-render-text — TemporalEngine property tests

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import { TemporalEngine } from "./temporalEngine.js";
import type { GlyphBitmap } from "./glyph.js";

function makeGlyph(width: number, height: number, data?: Uint8ClampedArray): GlyphBitmap {
  const imageData = new ImageData(width, height);
  if (data) imageData.data.set(data);
  return { char: "A", width, height, imageData };
}

// Feature: secure-render-text, Property 1: Layer union completeness
describe("TemporalEngine — Property 1: Layer union completeness", () => {
  it("union of all layers equals original pixel data", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 20 }),
        (width, height) => {
          const pixelCount = width * height * 4;
          const rawData = new Uint8ClampedArray(pixelCount);
          for (let i = 0; i < pixelCount; i++) rawData[i] = (i * 37 + 13) % 256;

          const glyph = makeGlyph(width, height, rawData);
          const engine = new TemporalEngine(60, 2);
          const [layersForGlyph] = engine.splitIntoLayers([glyph]);

          // Reconstruct union: pixel i belongs to layer i%2, so read from that layer
          const union = new Uint8ClampedArray(pixelCount);
          for (let i = 0; i < width * height; i++) {
            const layerIdx = i % 2;
            const offset = i * 4;
            union[offset] = layersForGlyph[layerIdx].data[offset];
            union[offset + 1] = layersForGlyph[layerIdx].data[offset + 1];
            union[offset + 2] = layersForGlyph[layerIdx].data[offset + 2];
            union[offset + 3] = layersForGlyph[layerIdx].data[offset + 3];
          }

          for (let i = 0; i < pixelCount; i++) {
            if (union[i] !== rawData[i]) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: secure-render-text, Property 2: Layer disjointness
describe("TemporalEngine — Property 2: Layer disjointness", () => {
  it("no pixel position is non-transparent in more than one layer", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 20 }),
        (width, height) => {
          const pixelCount = width * height * 4;
          const rawData = new Uint8ClampedArray(pixelCount);
          // Make all pixels fully opaque so disjointness is meaningful
          for (let i = 0; i < width * height; i++) {
            rawData[i * 4] = 200;
            rawData[i * 4 + 1] = 100;
            rawData[i * 4 + 2] = 50;
            rawData[i * 4 + 3] = 255;
          }

          const glyph = makeGlyph(width, height, rawData);
          const engine = new TemporalEngine(60, 2);
          const [layersForGlyph] = engine.splitIntoLayers([glyph]);

          for (let i = 0; i < width * height; i++) {
            const offset = i * 4;
            let nonTransparentCount = 0;
            for (const layer of layersForGlyph) {
              if (layer.data[offset + 3] !== 0) nonTransparentCount++;
            }
            if (nonTransparentCount > 1) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: secure-render-text, Property 7: Stop cancels animation frame
describe("TemporalEngine — Property 7: Stop cancels RAF", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("after stop(), no further requestAnimationFrame callbacks are invoked", () => {
    const callbacks: FrameRequestCallback[] = [];
    let rafId = 0;

    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      callbacks.push(cb);
      return ++rafId;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      // Remove the callback at that id index
      callbacks.splice(id - 1, 1);
    });

    const engine = new TemporalEngine(60, 2);
    const glyph = makeGlyph(4, 4);
    const layers = engine.splitIntoLayers([glyph]);
    const onFrame = vi.fn();

    engine.start([glyph], layers, onFrame);
    engine.stop();

    // Simulate rAF firing after stop — should not invoke onFrame
    const countBefore = onFrame.mock.calls.length;
    // Any remaining callbacks should not be called since stop cancelled them
    expect(callbacks.length).toBe(0);
    expect(onFrame.mock.calls.length).toBe(countBefore);
  });
});
