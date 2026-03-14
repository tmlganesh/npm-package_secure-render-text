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
