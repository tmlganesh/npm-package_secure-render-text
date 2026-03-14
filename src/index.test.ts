// Feature: secure-render-text — Public API property tests

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import SecureRender from "./index.js";

// Silence WebGL errors in jsdom for validation tests (no real WebGL available)
// Property 11 sets its own mock, so we only apply this for non-P11 tests

afterEach(() => {
  vi.restoreAllMocks();
  SecureRender.stop();
});

// Feature: secure-render-text, Property 3: API input validation — invalid element
describe("Property 3: invalid element throws", () => {
  it("throws for any selector that does not resolve to an HTMLCanvasElement", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.startsWith("#canvas")),
        (selector) => {
          expect(() =>
            SecureRender.render({ element: selector, text: "hello" })
          ).toThrow("SecureRender: element must resolve to an HTMLCanvasElement");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("throws when passed a non-canvas DOM element reference", () => {
    const div = document.createElement("div");
    expect(() =>
      SecureRender.render({ element: div as unknown as HTMLCanvasElement, text: "hello" })
    ).toThrow("SecureRender: element must resolve to an HTMLCanvasElement");
  });
});

// Feature: secure-render-text, Property 4: API input validation — text length
describe("Property 4: text length validation", () => {
  it("throws for any string longer than 500 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 501, maxLength: 1000 }),
        (longText) => {
          const canvas = document.createElement("canvas");
          expect(() =>
            SecureRender.render({ element: canvas, text: longText })
          ).toThrow("SecureRender: text exceeds 500 character limit");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: secure-render-text, Property 5: API input validation — fps range
describe("Property 5: fps range validation", () => {
  it("throws for fps below 1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10000, max: 0 }),
        (fps) => {
          const canvas = document.createElement("canvas");
          expect(() =>
            SecureRender.render({ element: canvas, text: "hello", fps })
          ).toThrow("SecureRender: fps must be between 1 and 120");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("throws for fps above 120", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 121, max: 10000 }),
        (fps) => {
          const canvas = document.createElement("canvas");
          expect(() =>
            SecureRender.render({ element: canvas, text: "hello", fps })
          ).toThrow("SecureRender: fps must be between 1 and 120");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: secure-render-text, Property 6: API input validation — pattern values
describe("Property 6: pattern value validation", () => {
  const validPatterns = new Set(["stripe", "diagonal", "crosshatch"]);

  it("throws for any string not in the valid pattern set", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !validPatterns.has(s)),
        (invalidPattern) => {
          const canvas = document.createElement("canvas");
          expect(() =>
            SecureRender.render({
              element: canvas,
              text: "hello",
              pattern: invalidPattern as any,
            })
          ).toThrow("SecureRender: pattern must be one of stripe | diagonal | crosshatch");
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: secure-render-text, Property 11: Re-render stops previous loop
describe("Property 11: re-render stops previous loop", () => {
  it("calling render() twice stops the first loop before starting the second", () => {
    const cancelled: number[] = [];
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      cancelled.push(id);
    });
    vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(42);

    // Minimal 2D context mock so GlyphEngine doesn't crash
    const mock2d = {
      font: "",
      fillStyle: "" as any,
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      clearRect: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      getImageData: vi.fn().mockReturnValue(new ImageData(10, 48)),
      createPattern: vi.fn().mockReturnValue({}),
      strokeStyle: "",
      lineWidth: 1,
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    };

    // Minimal WebGL context mock
    const mockWebGL = {
      createShader: vi.fn().mockReturnValue({}),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn().mockReturnValue(true),
      createProgram: vi.fn().mockReturnValue({}),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn().mockReturnValue(true),
      createBuffer: vi.fn().mockReturnValue({}),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      createTexture: vi.fn().mockReturnValue({}),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      getUniformLocation: vi.fn().mockReturnValue({}),
      getAttribLocation: vi.fn().mockReturnValue(0),
      deleteBuffer: vi.fn(),
      deleteTexture: vi.fn(),
      deleteFramebuffer: vi.fn(),
      deleteProgram: vi.fn(),
      canvas: { width: 100, height: 48 },
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      COMPILE_STATUS: 35713,
      LINK_STATUS: 35714,
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      TEXTURE_2D: 3553,
      CLAMP_TO_EDGE: 33071,
      TEXTURE_WRAP_S: 10242,
      TEXTURE_WRAP_T: 10243,
      TEXTURE_MIN_FILTER: 10241,
      TEXTURE_MAG_FILTER: 10240,
      LINEAR: 9729,
    };

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((type: string) => {
      if (type === "2d") return mock2d as any;
      if (type === "webgl") return mockWebGL as any;
      return null;
    });

    const canvas = document.createElement("canvas");

    SecureRender.render({ element: canvas, text: "hello", fps: 60 });
    // Second render should stop the first
    SecureRender.render({ element: canvas, text: "world", fps: 60 });

    // cancelAnimationFrame must have been called at least once (stopping first loop)
    expect(cancelled.length).toBeGreaterThanOrEqual(1);
  });
});
