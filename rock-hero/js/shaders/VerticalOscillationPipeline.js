/**
 * VerticalOscillationPipeline - Shader PostFX
 *
 * Aplica uma onda senoidal vertical sobre a textura, criando um efeito
 * "trippy" de distorção. Usado pelo power-up cogumelo.
 *
 * Adaptado do exemplo:
 *   https://github.com/devshareacademy/phaser-3-typescript-games-and-examples
 *   (vertical-oscillation-shader / examples/3.90)
 *
 * Aplicação:
 *   const renderer = scene.renderer;
 *   if (!renderer.pipelines.get('VerticalOscillationPipeline')) {
 *       renderer.pipelines.addPostPipeline('VerticalOscillationPipeline', VerticalOscillationPipeline);
 *   }
 *   scene.cameras.main.setPostPipeline('VerticalOscillationPipeline');
 *
 *   // Para acessar a instância e ajustar parâmetros em runtime:
 *   const pipeline = scene.cameras.main.getPostPipeline('VerticalOscillationPipeline');
 *   pipeline.amplitude = 0.05;
 *   pipeline.speed = 1.0;
 *   pipeline.frequency = 20.0;
 *
 *   // Remover:
 *   scene.cameras.main.removePostPipeline('VerticalOscillationPipeline');
 */

const VERTICAL_OSCILLATION_FRAG = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float u_time;
uniform float u_speed;
uniform float u_amplitude;
uniform float u_frequency;
uniform float u_hueShift;

varying vec2 outTexCoord;

// Conversões HSV <-> RGB (versão padrão usada em shaders GLSL)
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main(void) {
    // Distorção vertical
    float wave = sin(outTexCoord.x * u_frequency + u_time * u_speed);
    float offset = wave * u_amplitude;
    vec2 newCoords = vec2(outTexCoord.x, outTexCoord.y + offset);

    vec4 src = texture2D(uMainSampler, newCoords);

    // Palette cycling via rotação de matiz (HSV)
    if (u_hueShift != 0.0) {
        vec3 hsv = rgb2hsv(src.rgb);
        hsv.x = fract(hsv.x + u_hueShift);
        src.rgb = hsv2rgb(hsv);
    }

    gl_FragColor = src;
}
`;

class VerticalOscillationPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    constructor(game) {
        super({
            game,
            fragShader: VERTICAL_OSCILLATION_FRAG
        });

        this.speed = 1.0;
        this.amplitude = 0.05;
        this.frequency = 20.0;

        // Velocidade de rotação do matiz em ciclos completos por segundo (0 = desliga)
        this.hueSpeed = 0.0;
    }

    onPreRender() {
        const t = this.game.loop.time / 1000;
        this.set1f('u_time', t);
        this.set1f('u_speed', this.speed);
        this.set1f('u_amplitude', this.amplitude);
        this.set1f('u_frequency', this.frequency);
        // Calcula o shift atual a partir do tempo, evita acumular drift entre frames
        this.set1f('u_hueShift', this.hueSpeed === 0 ? 0 : (t * this.hueSpeed) % 1.0);
    }
}

window.VerticalOscillationPipeline = VerticalOscillationPipeline;
