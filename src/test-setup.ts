// Polyfill ImageData for jsdom using the canvas package
import { ImageData as CanvasImageData } from "canvas";

if (typeof globalThis.ImageData === "undefined") {
  (globalThis as any).ImageData = CanvasImageData;
}
