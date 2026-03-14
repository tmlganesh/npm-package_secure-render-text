// Renderer — top-level orchestrator that wires all pipeline components

import { GlyphEngine } from "./glyph.js";
import { TemporalEngine } from "./temporalEngine.js";
import { ShaderPipeline } from "./shaderPipeline.js";

export type PatternType = "stripe" | "diagonal" | "crosshatch";

export interface RenderOptions {
  element: string | HTMLCanvasElement;
  text: string;
  fps?: number;
  pattern?: PatternType;
  distortion?: boolean;
}

export interface ResolvedRenderOptions {
  canvas: HTMLCanvasElement;
  text: string;
  fps: number;
  pattern: PatternType;
  distortion: boolean;
}

export interface SecureRenderAPI {
  render(options: RenderOptions): void;
  stop(): void;
}

export class Renderer {
  private options: ResolvedRenderOptions;
  private temporal: TemporalEngine | null = null;
  private shader: ShaderPipeline | null = null;
  private running: boolean = false;

  constructor(options: ResolvedRenderOptions) {
    this.options = options;
  }

  start(): void {
    const { canvas, text, fps, pattern, distortion } = this.options;

    // Resize canvas to fit text
    const fontSize = 48;
    canvas.height = fontSize;

    const glyphEngine = new GlyphEngine(fontSize, pattern);
    const glyphs = glyphEngine.renderGlyphs(text);

    // Set canvas width to total glyph width
    const totalWidth = glyphs.reduce((sum, g) => sum + g.width, 0);
    canvas.width = Math.max(totalWidth, 1);
    canvas.height = fontSize;

    const temporal = new TemporalEngine(fps, 2);
    const glyphLayers = temporal.splitIntoLayers(glyphs);

    const shader = new ShaderPipeline(canvas, distortion);

    this.temporal = temporal;
    this.shader = shader;
    this.running = true;

    temporal.start(glyphs, glyphLayers, (frame) => {
      shader.uploadFrame(frame.compositeImageData);
      shader.render(performance.now());
    });
  }

  stop(): void {
    if (!this.running) return;
    this.temporal?.stop();
    this.shader?.dispose();
    this.temporal = null;
    this.shader = null;
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}
