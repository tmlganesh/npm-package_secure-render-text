// src/patternEngine.ts
var PatternEngine = class {
  constructor(ctx) {
    this.ctx = ctx;
  }
  getPattern(type) {
    const size = 4;
    
    const offscreen = document.createElement("canvas");
    offscreen.width = size;
    offscreen.height = size;
    const offCtx = offscreen.getContext("2d");
    offCtx.clearRect(0, 0, size, size);
    offCtx.strokeStyle = "#000000";
    offCtx.lineWidth = 1;
    if (type === "stripe") {
      for (let x = 0; x < size; x += 2) {
        offCtx.beginPath();
        offCtx.moveTo(x + 0.5, 0);
        offCtx.lineTo(x + 0.5, size);
        offCtx.stroke();
      }
    } else if (type === "diagonal") {
      offCtx.beginPath();
      offCtx.moveTo(0, 0);
      offCtx.lineTo(size, size);
      offCtx.stroke();
      offCtx.beginPath();
      offCtx.moveTo(2, 0);
      offCtx.lineTo(size, size - 2);
      offCtx.stroke();
      offCtx.beginPath();
      offCtx.moveTo(0, 2);
      offCtx.lineTo(size - 2, size);
      offCtx.stroke();
    } else if (type === "crosshatch") {
      for (let x = 0; x < size; x += 2) {
        offCtx.beginPath();
        offCtx.moveTo(x + 0.5, 0);
        offCtx.lineTo(x + 0.5, size);
        offCtx.stroke();
      }
      offCtx.beginPath();
      offCtx.moveTo(0, 0);
      offCtx.lineTo(size, size);
      offCtx.stroke();
      offCtx.beginPath();
      offCtx.moveTo(2, 0);
      offCtx.lineTo(size, size - 2);
      offCtx.stroke();
      offCtx.beginPath();
      offCtx.moveTo(0, 2);
      offCtx.lineTo(size - 2, size);
      offCtx.stroke();
    } else {
      throw new Error(`PatternEngine: unknown pattern type "${type}"`);
    }
    const pattern = this.ctx.createPattern(offscreen, "repeat");
    if (!pattern) {
      throw new Error(`PatternEngine: failed to create pattern for type "${type}"`);
    }
    return pattern;
  }
};

// src/glyph.ts
var GlyphEngine = class {
  constructor(fontSize, pattern) {
    this.fontSize = fontSize;
    this.pattern = pattern;
  }
  renderGlyphs(text) {
    const measureCanvas = document.createElement("canvas");
    measureCanvas.width = this.fontSize * 2;
    measureCanvas.height = this.fontSize * 2;
    const measureCtx = measureCanvas.getContext("2d");
    const font = `${this.fontSize}px monospace`;
    measureCtx.font = font;
    const patternEngine = new PatternEngine(measureCtx);
    const canvasPattern = patternEngine.getPattern(this.pattern);
    const glyphs = [];
    for (const char of text) {
      const metrics = measureCtx.measureText(char);
      const width = Math.max(Math.ceil(metrics.width), 1);
      const height = this.fontSize;
      const offscreen = document.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext("2d");
      ctx.font = font;
      ctx.save();
      ctx.beginPath();
      const baseline = Math.round(this.fontSize * 0.8);
      ctx.fillStyle = canvasPattern;
      ctx.fillText(char, 0, baseline);
      ctx.restore();
      const imageData = ctx.getImageData(0, 0, width, height);
      glyphs.push({ char, width, height, imageData });
    }
    return glyphs;
  }
};

// src/temporalEngine.ts
var TemporalEngine = class {
  constructor(fps, layerCount = 2) {
    this.rafId = null;
    this.lastFrameTime = 0;
    this.currentLayer = 0;
    this.fps = fps;
    this.layerCount = layerCount;
  }
  /**
   * Split an array of GlyphBitmaps into N layers using round-robin pixel assignment.
   * Returns a 2D array: layers[layerIndex] = composited ImageData for that layer.
   */
  splitIntoLayers(glyphs) {
    return glyphs.map((glyph) => {
      const { width, height, imageData } = glyph;
      const src = imageData.data;
      const layers = Array.from({ length: this.layerCount }, () => {
        const id = new ImageData(width, height);
        return id;
      });
      const pixelCount = width * height;
      for (let i = 0; i < pixelCount; i++) {
        const layer = i % this.layerCount;
        const offset = i * 4;
        layers[layer].data[offset] = src[offset];
        layers[layer].data[offset + 1] = src[offset + 1];
        layers[layer].data[offset + 2] = src[offset + 2];
        layers[layer].data[offset + 3] = src[offset + 3];
      }
      return layers;
    });
  }
  /**
   * Compose all per-glyph layer ImageDatas for the current layer into a single
   * wide ImageData that spans the full text width.
   */
  compositeLayer(glyphLayers, glyphs, layerIndex) {
    const totalWidth = glyphs.reduce((sum, g) => sum + g.width, 0);
    const height = glyphs[0]?.height ?? 0;
    const composite = new ImageData(Math.max(totalWidth, 1), Math.max(height, 1));
    let xOffset = 0;
    for (let gi = 0; gi < glyphs.length; gi++) {
      const glyph = glyphs[gi];
      const layerData = glyphLayers[gi][layerIndex];
      for (let row = 0; row < glyph.height; row++) {
        for (let col = 0; col < glyph.width; col++) {
          const srcIdx = (row * glyph.width + col) * 4;
          const dstIdx = (row * totalWidth + xOffset + col) * 4;
          composite.data[dstIdx] = layerData.data[srcIdx];
          composite.data[dstIdx + 1] = layerData.data[srcIdx + 1];
          composite.data[dstIdx + 2] = layerData.data[srcIdx + 2];
          composite.data[dstIdx + 3] = layerData.data[srcIdx + 3];
        }
      }
      xOffset += glyph.width;
    }
    return composite;
  }
  start(glyphs, glyphLayers, onFrame) {
    this.currentLayer = 0;
    this.lastFrameTime = 0;
    const tick = (timestamp) => {
      this.rafId = requestAnimationFrame(tick);
      const elapsed = timestamp - this.lastFrameTime;
      const interval = 1e3 / this.fps;
      if (elapsed >= interval) {
        this.lastFrameTime = timestamp - elapsed % interval;
        const compositeImageData = this.compositeLayer(glyphLayers, glyphs, this.currentLayer);
        onFrame({
          layerIndex: this.currentLayer,
          totalLayers: this.layerCount,
          compositeImageData
        });
        this.currentLayer = (this.currentLayer + 1) % this.layerCount;
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }
  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
};

// src/shaderPipeline.ts
var NOISE_FRAG_SRC = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_time;
varying vec2 v_texCoord;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 color = texture2D(u_texture, v_texCoord);
  float noise = (rand(v_texCoord + u_time) - 0.5) * 0.08;
  gl_FragColor = clamp(color + vec4(noise, noise, noise, 0.0), 0.0, 1.0);
}
`;
var DISTORTION_FRAG_SRC = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_time;
varying vec2 v_texCoord;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float dx = sin(v_texCoord.y * 40.0 + u_time * 6.28) * 0.003
           + (rand(vec2(v_texCoord.y, u_time)) - 0.5) * 0.004;
  float dy = sin(v_texCoord.x * 40.0 + u_time * 6.28) * 0.003
           + (rand(vec2(v_texCoord.x, u_time)) - 0.5) * 0.004;
  vec2 displaced = v_texCoord + vec2(dx, dy);
  gl_FragColor = texture2D(u_texture, displaced);
}
`;
var VERT_SRC = `
attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  // Map clip-space [-1,1] to texture coords [0,1]
  v_texCoord = (a_position + 1.0) * 0.5;
  // Flip Y so texture is right-side up
  v_texCoord.y = 1.0 - v_texCoord.y;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("SecureRender: failed to create shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`SecureRender: shader compile error: ${log}`);
  }
  return shader;
}
function linkProgram(gl, vert, frag) {
  const prog = gl.createProgram();
  if (!prog) throw new Error("SecureRender: failed to create program");
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`SecureRender: program link error: ${log}`);
  }
  return prog;
}
var ShaderPipeline = class {
  constructor(canvas, distortion) {
    this.distortionPass = null;
    // Intermediate framebuffer for chaining passes
    this.fbo = null;
    this.fboTexture = null;
    this.fboWidth = 0;
    this.fboHeight = 0;
    const gl = canvas.getContext("webgl");
    if (!gl) throw new Error("SecureRender: WebGL is not supported in this browser");
    this.gl = gl;
    this.distortion = distortion;
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const noiseFrag = compileShader(gl, gl.FRAGMENT_SHADER, NOISE_FRAG_SRC);
    const noiseProg = linkProgram(gl, vert, noiseFrag);
    this.noisePass = this.buildPass(gl, noiseProg);
    if (distortion) {
      const distFrag = compileShader(gl, gl.FRAGMENT_SHADER, DISTORTION_FRAG_SRC);
      const distProg = linkProgram(gl, vert, distFrag);
      this.distortionPass = this.buildPass(gl, distProg);
    }
    const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buf = gl.createBuffer();
    if (!buf) throw new Error("SecureRender: failed to create quad buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    this.quadBuffer = buf;
    const tex = gl.createTexture();
    if (!tex) throw new Error("SecureRender: failed to create texture");
    this.texture = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }
  buildPass(gl, program) {
    const uTexture = gl.getUniformLocation(program, "u_texture");
    const uTime = gl.getUniformLocation(program, "u_time");
    const aPosition = gl.getAttribLocation(program, "a_position");
    if (!uTexture || !uTime) throw new Error("SecureRender: missing shader uniforms");
    return { program, uTexture, uTime, aPosition };
  }
  ensureFBO(width, height) {
    const gl = this.gl;
    if (this.fbo && this.fboWidth === width && this.fboHeight === height) return;
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    if (this.fboTexture) gl.deleteTexture(this.fboTexture);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fbo = fbo;
    this.fboTexture = tex;
    this.fboWidth = width;
    this.fboHeight = height;
  }
  drawPass(pass, srcTexture, timestamp) {
    const gl = this.gl;
    gl.useProgram(pass.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(pass.aPosition);
    gl.vertexAttribPointer(pass.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTexture);
    gl.uniform1i(pass.uTexture, 0);
    gl.uniform1f(pass.uTime, timestamp / 1e3);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  uploadFrame(imageData) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
  }
  render(timestamp) {
    const gl = this.gl;
    const w = gl.canvas.width;
    const h = gl.canvas.height;
    gl.viewport(0, 0, w, h);
    if (this.distortion && this.distortionPass) {
      this.ensureFBO(w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      this.drawPass(this.noisePass, this.texture, timestamp);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.drawPass(this.distortionPass, this.fboTexture, timestamp);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.drawPass(this.noisePass, this.texture, timestamp);
    }
  }
  dispose() {
    const gl = this.gl;
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteTexture(this.texture);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    if (this.fboTexture) gl.deleteTexture(this.fboTexture);
    gl.deleteProgram(this.noisePass.program);
    if (this.distortionPass) gl.deleteProgram(this.distortionPass.program);
  }
};

// src/renderer.ts
var Renderer = class {
  constructor(options) {
    this.temporal = null;
    this.shader = null;
    this.running = false;
    this.options = options;
  }
  start() {
    const { canvas, text, fps, pattern, distortion } = this.options;
    const fontSize = 48;
    canvas.height = fontSize;
    const glyphEngine = new GlyphEngine(fontSize, pattern);
    const glyphs = glyphEngine.renderGlyphs(text);
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
  stop() {
    if (!this.running) return;
    this.temporal?.stop();
    this.shader?.dispose();
    this.temporal = null;
    this.shader = null;
    this.running = false;
  }
  isRunning() {
    return this.running;
  }
};

// src/index.ts
var VALID_PATTERNS = ["stripe", "diagonal", "crosshatch"];
var activeRenderer = null;
function resolveCanvas(element) {
  if (element instanceof HTMLCanvasElement) return element;
  if (typeof element === "string") {
    try {
      const el = document.querySelector(element);
      if (el instanceof HTMLCanvasElement) return el;
    } catch {
    }
  }
  throw new Error("SecureRender: element must resolve to an HTMLCanvasElement");
}
var SecureRender = {
  render(options) {
    if (activeRenderer) {
      activeRenderer.stop();
      activeRenderer = null;
    }
    const canvas = resolveCanvas(options.element);
    if (!options || typeof options.text !== "string") {
      throw new Error("SecureRender: text must be a valid string");
    }

    if (options.text.trim() === "") {
      throw new Error("SecureRender: text cannot be empty. Please enter some content.");
    }

    if (options.text.length > 500) {
      throw new Error("SecureRender: text exceeds 500 character limit");
    }
    const fps = options.fps ?? 90;
    if (!Number.isFinite(fps) || fps < 1 || fps > 120) {
      throw new Error("SecureRender: fps must be between 1 and 120");
    }
    const pattern = options.pattern ?? "stripe";
    if (!VALID_PATTERNS.includes(pattern)) {
      throw new Error("SecureRender: pattern must be one of stripe | diagonal | crosshatch");
    }
    const distortion = options.distortion ?? true;
    const renderer = new Renderer({ canvas, text: options.text, fps, pattern, distortion });
    renderer.start();
    activeRenderer = renderer;
  },
  stop() {
    if (activeRenderer) {
      activeRenderer.stop();
      activeRenderer = null;
    }
  }
};
var index_default = SecureRender;
export {
  index_default as default
};
//# sourceMappingURL=index.js.map