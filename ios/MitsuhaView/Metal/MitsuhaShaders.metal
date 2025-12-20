/**
 * MitsuhaShaders.metal
 * Shaders de Metal para el visualizador Mitsuha
 * 
 * Renderiza ondas tipo Jello con curvas Bézier cuadráticas en la GPU
 * Usa SDF (Signed Distance Function) para anti-aliasing de alta calidad
 */

#include <metal_stdlib>
using namespace metal;

// ============================================================================
// MARK: - Estructuras de datos
// ============================================================================

struct VertexIn {
    float2 position [[attribute(0)]];
    float2 texCoord [[attribute(1)]];
};

struct VertexOut {
    float4 position [[position]];
    float2 texCoord;
};

struct Uniforms {
    float4x4 projectionMatrix;
    float4 waveColor;
    float4 subwaveColor;
    float time;
    float waveOffset;
    float gain;
    float sensitivity;
    int numberOfPoints;
    float2 viewportSize;
};

// Buffer de puntos de la onda (máximo 64 puntos)
struct WavePoints {
    float2 points[64];
    int count;
};

// ============================================================================
// MARK: - Funciones auxiliares
// ============================================================================

// Interpolación suave (smoothstep mejorado)
float smootherstep(float edge0, float edge1, float x) {
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

// Calcular punto en curva Bézier cuadrática
float2 quadraticBezier(float2 p0, float2 p1, float2 p2, float t) {
    float oneMinusT = 1.0 - t;
    return oneMinusT * oneMinusT * p0 + 2.0 * oneMinusT * t * p1 + t * t * p2;
}

// Distancia a una curva Bézier cuadrática (aproximación)
float distanceToBezier(float2 pos, float2 p0, float2 p1, float2 p2) {
    float minDist = 1e10;
    
    // Muestrear la curva en 16 puntos
    for (int i = 0; i <= 16; i++) {
        float t = float(i) / 16.0;
        float2 curvePoint = quadraticBezier(p0, p1, p2, t);
        float dist = length(pos - curvePoint);
        minDist = min(minDist, dist);
    }
    
    return minDist;
}

// Calcular punto medio
float2 midPoint(float2 p1, float2 p2) {
    return (p1 + p2) * 0.5;
}

// Calcular punto de control para curva Jello
float2 controlPoint(float2 mid, float2 p) {
    float2 control = mid;
    float diffY = abs(p.y - control.y);
    
    if (p.y < mid.y) {
        control.y += diffY;
    } else if (p.y > mid.y) {
        control.y -= diffY;
    }
    
    return control;
}

// ============================================================================
// MARK: - Vertex Shader
// ============================================================================

vertex VertexOut mitsuhaVertexShader(
    uint vertexID [[vertex_id]],
    constant Uniforms &uniforms [[buffer(0)]]
) {
    // Quad de pantalla completa
    float2 positions[6] = {
        float2(-1.0, -1.0),
        float2( 1.0, -1.0),
        float2(-1.0,  1.0),
        float2( 1.0, -1.0),
        float2( 1.0,  1.0),
        float2(-1.0,  1.0)
    };
    
    float2 texCoords[6] = {
        float2(0.0, 1.0),
        float2(1.0, 1.0),
        float2(0.0, 0.0),
        float2(1.0, 1.0),
        float2(1.0, 0.0),
        float2(0.0, 0.0)
    };
    
    VertexOut out;
    out.position = float4(positions[vertexID], 0.0, 1.0);
    out.texCoord = texCoords[vertexID];
    return out;
}

// ============================================================================
// MARK: - Fragment Shader Principal (Onda Jello)
// ============================================================================

fragment float4 mitsuhaJelloFragmentShader(
    VertexOut in [[stage_in]],
    constant Uniforms &uniforms [[buffer(0)]],
    constant WavePoints &wave [[buffer(1)]],
    constant WavePoints &subwave [[buffer(2)]]
) {
    float2 pos = in.texCoord * uniforms.viewportSize;
    float height = uniforms.viewportSize.y;
    
    // Calcular si estamos dentro de la onda principal
    float waveY = height; // Empezar desde abajo
    
    // Encontrar el segmento de curva más cercano
    if (wave.count > 1) {
        // Interpolar entre puntos para encontrar Y en esta X
        float x = pos.x;
        
        for (int i = 0; i < wave.count - 1; i++) {
            float2 p1 = wave.points[i];
            float2 p2 = wave.points[i + 1];
            
            if (x >= p1.x && x <= p2.x) {
                // Interpolación lineal simple para encontrar Y
                float t = (x - p1.x) / max(p2.x - p1.x, 0.001);
                
                // Usar curva Bézier para suavizado
                float2 mid = midPoint(p1, p2);
                float2 ctrl = controlPoint(mid, p1);
                
                // Aproximar Y en la curva
                float2 bezierPoint = quadraticBezier(p1, ctrl, p2, t);
                waveY = bezierPoint.y;
                break;
            }
        }
    }
    
    // Calcular subwave Y (con offset temporal para efecto de eco)
    float subwaveY = height;
    if (subwave.count > 1) {
        float x = pos.x;
        
        for (int i = 0; i < subwave.count - 1; i++) {
            float2 p1 = subwave.points[i];
            float2 p2 = subwave.points[i + 1];
            
            if (x >= p1.x && x <= p2.x) {
                float t = (x - p1.x) / max(p2.x - p1.x, 0.001);
                float2 mid = midPoint(p1, p2);
                float2 ctrl = controlPoint(mid, p1);
                float2 bezierPoint = quadraticBezier(p1, ctrl, p2, t);
                subwaveY = bezierPoint.y;
                break;
            }
        }
    }
    
    // Anti-aliasing suave en el borde
    float edgeWidth = 2.0; // pixels
    
    // Onda principal
    float mainWaveMask = smootherstep(waveY + edgeWidth, waveY - edgeWidth, pos.y);
    
    // Subonda (detrás)
    float subWaveMask = smootherstep(subwaveY + edgeWidth, subwaveY - edgeWidth, pos.y);
    
    // Componer colores con blending
    float4 color = float4(0.0);
    
    // Subonda primero (detrás)
    color = mix(color, uniforms.subwaveColor, subWaveMask * uniforms.subwaveColor.a);
    
    // Onda principal encima
    color = mix(color, uniforms.waveColor, mainWaveMask * uniforms.waveColor.a);
    
    return color;
}

// ============================================================================
// MARK: - Fragment Shader con Glow
// ============================================================================

fragment float4 mitsuhaGlowFragmentShader(
    VertexOut in [[stage_in]],
    constant Uniforms &uniforms [[buffer(0)]],
    constant WavePoints &wave [[buffer(1)]],
    constant WavePoints &subwave [[buffer(2)]]
) {
    float2 pos = in.texCoord * uniforms.viewportSize;
    float height = uniforms.viewportSize.y;
    
    float waveY = height;
    
    if (wave.count > 1) {
        float x = pos.x;
        
        for (int i = 0; i < wave.count - 1; i++) {
            float2 p1 = wave.points[i];
            float2 p2 = wave.points[i + 1];
            
            if (x >= p1.x && x <= p2.x) {
                float t = (x - p1.x) / max(p2.x - p1.x, 0.001);
                float2 mid = midPoint(p1, p2);
                float2 ctrl = controlPoint(mid, p1);
                float2 bezierPoint = quadraticBezier(p1, ctrl, p2, t);
                waveY = bezierPoint.y;
                break;
            }
        }
    }
    
    // Calcular distancia al borde de la onda
    float distToEdge = pos.y - waveY;
    
    // Glow effect
    float glowRadius = 20.0;
    float glow = exp(-abs(distToEdge) / glowRadius);
    
    // Máscara de la onda
    float waveMask = smootherstep(waveY + 2.0, waveY - 2.0, pos.y);
    
    // Color con glow
    float4 color = uniforms.waveColor * waveMask;
    
    // Añadir glow solo arriba de la onda
    if (distToEdge < 0) {
        float4 glowColor = uniforms.waveColor * glow * 0.5;
        color += glowColor;
    }
    
    return color;
}

// ============================================================================
// MARK: - Fragment Shader Siri Style
// ============================================================================

fragment float4 mitsuhaSiriFragmentShader(
    VertexOut in [[stage_in]],
    constant Uniforms &uniforms [[buffer(0)]],
    constant WavePoints &wave [[buffer(1)]]
) {
    float2 pos = in.texCoord * uniforms.viewportSize;
    float2 center = uniforms.viewportSize * 0.5;
    
    // Convertir a coordenadas polares
    float2 delta = pos - center;
    float radius = length(delta);
    float angle = atan2(delta.y, delta.x);
    
    // Calcular radio base de la onda
    float baseRadius = min(center.x, center.y) * 0.6;
    
    // Modulación basada en datos de audio
    float audioMod = 0.0;
    if (wave.count > 0) {
        // Mapear ángulo a índice de datos
        float normalizedAngle = (angle + M_PI_F) / (2.0 * M_PI_F);
        int index = int(normalizedAngle * float(wave.count)) % wave.count;
        
        // Usar Y del punto como amplitud
        audioMod = (wave.points[index].y / uniforms.viewportSize.y) * uniforms.gain * 2.0;
    }
    
    float waveRadius = baseRadius + audioMod * 30.0;
    
    // Distancia al borde
    float dist = abs(radius - waveRadius);
    
    // Múltiples anillos con diferentes opacidades
    float ring1 = exp(-dist * 0.3);
    float ring2 = exp(-abs(radius - waveRadius * 0.8) * 0.2) * 0.5;
    float ring3 = exp(-abs(radius - waveRadius * 0.6) * 0.15) * 0.3;
    
    float intensity = ring1 + ring2 + ring3;
    
    // Gradiente de color basado en ángulo
    float hueShift = sin(angle + uniforms.time) * 0.1;
    float4 color = uniforms.waveColor;
    color.rgb = mix(color.rgb, uniforms.subwaveColor.rgb, hueShift + 0.5);
    
    return color * intensity;
}

// ============================================================================
// MARK: - Compute Shader para FFT (optimización futura)
// ============================================================================

kernel void processAudioFFT(
    device float *audioData [[buffer(0)]],
    device float *fftOutput [[buffer(1)]],
    constant uint &dataLength [[buffer(2)]],
    uint id [[thread_position_in_grid]]
) {
    if (id >= dataLength) return;
    
    // Aplicar ventana Hann
    float windowValue = 0.5 * (1.0 - cos(2.0 * M_PI_F * float(id) / float(dataLength - 1)));
    fftOutput[id] = audioData[id] * windowValue;
}
