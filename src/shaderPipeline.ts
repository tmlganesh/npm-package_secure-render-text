// ShaderPipeline — WebGL-based noise and distortion post-process passes

const NOISE_FRAG_SRC = `
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

const DISTORTION_FRAG_SRC = `
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

const VERT_SRC = `
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

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
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

function linkProgram(
  gl: WebGLRenderingContext,
  vert: WebGLShader,
  frag: WebGLShader
): WebGLProgram {
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

interface ShaderPass {
  program: WebGLProgram;
  uTexture: WebGLUniformLocation;
  uTime: WebGLUniformLocation;
  aPosition: number;
}

export class ShaderPipeline {
  private gl: WebGLRenderingContext;
  private distortion: boolean;
  private noisePass: ShaderPass;
  private distortionPass: ShaderPass | null = null;
  private quadBuffer: WebGLBuffer;
  private texture: WebGLTexture;
  // Intermediate framebuffer for chaining passes
  private fbo: WebGLFramebuffer | null = null;
  private fboTexture: WebGLTexture | null = null;
  private fboWidth: number = 0;
  private fboHeight: number = 0;

  constructor(canvas: HTMLCanvasElement, distortion: boolean) {
    const gl = canvas.getContext("webgl");
    if (!gl) throw new Error("SecureRender: WebGL is not supported in this browser");
    this.gl = gl;
    this.distortion = distortion;

    // Build shader passes
    const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);

    const noiseFrag = compileShader(gl, gl.FRAGMENT_SHADER, NOISE_FRAG_SRC);
    const noiseProg = linkProgram(gl, vert, noiseFrag);
    this.noisePass = this.buildPass(gl, noiseProg);

    if (distortion) {
      const distFrag = compileShader(gl, gl.FRAGMENT_SHADER, DISTORTION_FRAG_SRC);
      const distProg = linkProgram(gl, vert, distFrag);
      this.distortionPass = this.buildPass(gl, distProg);
    }

    // Full-screen quad: two triangles covering clip space
    const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buf = gl.createBuffer();
    if (!buf) throw new Error("SecureRender: failed to create quad buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    this.quadBuffer = buf;

    // Main input texture
    const tex = gl.createTexture();
    if (!tex) throw new Error("SecureRender: failed to create texture");
    this.texture = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  private buildPass(gl: WebGLRenderingContext, program: WebGLProgram): ShaderPass {
    const uTexture = gl.getUniformLocation(program, "u_texture");
    const uTime = gl.getUniformLocation(program, "u_time");
    const aPosition = gl.getAttribLocation(program, "a_position");
    if (!uTexture || !uTime) throw new Error("SecureRender: missing shader uniforms");
    return { program, uTexture, uTime, aPosition };
  }

  private ensureFBO(width: number, height: number): void {
    const gl = this.gl;
    if (this.fbo && this.fboWidth === width && this.fboHeight === height) return;

    // Clean up old FBO
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    if (this.fboTexture) gl.deleteTexture(this.fboTexture);

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.fbo = fbo;
    this.fboTexture = tex;
    this.fboWidth = width;
    this.fboHeight = height;
  }

  private drawPass(pass: ShaderPass, srcTexture: WebGLTexture, timestamp: number): void {
    const gl = this.gl;
    gl.useProgram(pass.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(pass.aPosition);
    gl.vertexAttribPointer(pass.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTexture);
    gl.uniform1i(pass.uTexture, 0);
    gl.uniform1f(pass.uTime, timestamp / 1000.0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  uploadFrame(imageData: ImageData): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
  }

  render(timestamp: number): void {
    const gl = this.gl;
    const w = gl.canvas.width;
    const h = gl.canvas.height;
    gl.viewport(0, 0, w, h);

    if (this.distortion && this.distortionPass) {
      // Pass 1: noise → FBO texture
      this.ensureFBO(w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      this.drawPass(this.noisePass, this.texture, timestamp);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // Pass 2: distortion → screen
      this.drawPass(this.distortionPass, this.fboTexture!, timestamp);
    } else {
      // Noise only → screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.drawPass(this.noisePass, this.texture, timestamp);
    }
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteTexture(this.texture);
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    if (this.fboTexture) gl.deleteTexture(this.fboTexture);
    gl.deleteProgram(this.noisePass.program);
    if (this.distortionPass) gl.deleteProgram(this.distortionPass.program);
  }
}
