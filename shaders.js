const vs = `#version 300 es
in vec4 a_position;
in vec2 a_texcoord;
in vec3 a_normal;
in vec4 a_color;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
uniform mat4 u_textureMatrix;
uniform vec3 u_viewWorldPosition;

out vec3 v_normal;
out vec3 v_surfaceToView;
out vec2 v_texcoord;
out vec4 v_projectedTexcoord;
out vec4 v_color;

void main() {
  vec4 worldPosition = u_world * a_position;
  gl_Position = u_projection * u_view * worldPosition;

  v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;
  v_normal = mat3(u_world) * a_normal;
  v_texcoord = a_texcoord;
  v_projectedTexcoord = u_textureMatrix * worldPosition;
  v_color = a_color;
}
`;

const fs = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_surfaceToView;
in vec2 v_texcoord;
in vec4 v_projectedTexcoord;
in vec4 v_color;

uniform vec3 diffuse;
uniform sampler2D diffuseMap;
uniform vec3 ambient;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
uniform vec3 u_ambientLight;

uniform sampler2D u_projectedTexture;
uniform float u_bias;
uniform vec3 u_reverseLightDirection;

out vec4 outColor;

const int KERNEL_SIZE = 4; 
const float OFFSET = 1.0 / 1024.0; // Offset for PCF sampling

float PCF(vec3 projectedTexcoord) {
    float shadow = 0.0;
    float currentDepth = projectedTexcoord.z + u_bias;
    bool inRange =
        projectedTexcoord.x >= 0.0 &&
        projectedTexcoord.x <= 1.0 &&
        projectedTexcoord.y >= 0.0 &&
        projectedTexcoord.y <= 1.0;

    if (!inRange) {
        return 1.0;
    }

    // Number of samples to average
    float numSamples = 0.0;

    // Sample the depth value from the shadow map with a PCF kernel
    for (int x = -KERNEL_SIZE; x <= KERNEL_SIZE; ++x) {
        for (int y = -KERNEL_SIZE; y <= KERNEL_SIZE; ++y) {
            vec2 offset = vec2(float(x) * OFFSET, float(y) * OFFSET);
            float projectedDepth = texture(u_projectedTexture, projectedTexcoord.xy + offset).r;
            
            if (projectedDepth <= currentDepth) {
                shadow += 0.0;
            } else {
                shadow += 1.0;
            }
            numSamples += 1.0;
        }
    }

    shadow /= numSamples;
    return shadow;
}


void main() {
    vec3 normal = normalize(v_normal);
    float light = dot(normal, u_reverseLightDirection);

    vec3 projectedTexcoord = v_projectedTexcoord.xyz / v_projectedTexcoord.w;

    float shadowLight = PCF(projectedTexcoord);

    vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
    float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;
    
    outColor = vec4(
        effectiveDiffuse * light * shadowLight +
        ambient * u_ambientLight +
        emissive +
        specular * pow(max(dot(normal, normalize(v_surfaceToView)), 0.0), shininess),
        effectiveOpacity
    );
}

`;

const colorVS = `#version 300 es
in vec4 a_position;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;

void main() {
  gl_Position = u_projection * u_view * u_world * a_position;
}
`;

const colorFS = `#version 300 es
precision highp float;

uniform vec4 u_color;

out vec4 outColor;

void main() {
  outColor = u_color;
}
`;