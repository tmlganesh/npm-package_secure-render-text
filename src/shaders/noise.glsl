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
