/**
 * MitsuhaMetalRenderer.swift
 * Renderer de Metal para el visualizador Mitsuha
 * 
 * Maneja el pipeline de renderizado, buffers y sincronización con la GPU
 */

import MetalKit
import simd

// MARK: - Estructuras que coinciden con el shader

struct MitsuhaUniforms {
    var projectionMatrix: simd_float4x4
    var waveColor: simd_float4
    var subwaveColor: simd_float4
    var time: Float
    var waveOffset: Float
    var gain: Float
    var sensitivity: Float
    var numberOfPoints: Int32
    var padding1: Int32 = 0
    var padding2: Int32 = 0
    var padding3: Int32 = 0
    var viewportSize: simd_float2
    var padding4: simd_float2 = simd_float2(0, 0)
}

struct WavePointsBuffer {
    var points: (
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2,
        simd_float2, simd_float2, simd_float2, simd_float2
    ) = (
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0),
        simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0), simd_float2(0, 0)
    )
    var count: Int32 = 0
    var padding: simd_int3 = simd_int3(0, 0, 0)
    
    mutating func setPoint(at index: Int, point: simd_float2) {
        withUnsafeMutableBytes(of: &points) { rawPtr in
            let floatPtr = rawPtr.baseAddress!.assumingMemoryBound(to: simd_float2.self)
            floatPtr[index] = point
        }
    }
}

// MARK: - MitsuhaMetalRenderer

final class MitsuhaMetalRenderer: NSObject {
    
    // MARK: - Metal Objects
    
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue
    private var pipelineState: MTLRenderPipelineState?
    private var glowPipelineState: MTLRenderPipelineState?
    private var siriPipelineState: MTLRenderPipelineState?
    
    // MARK: - Buffers
    
    private var uniformsBuffer: MTLBuffer?
    private var wavePointsBuffer: MTLBuffer?
    private var subwavePointsBuffer: MTLBuffer?
    
    // MARK: - State
    
    private var uniforms = MitsuhaUniforms(
        projectionMatrix: matrix_identity_float4x4,
        waveColor: simd_float4(0.2, 0.6, 1.0, 1.0),
        subwaveColor: simd_float4(0.2, 0.6, 1.0, 0.6),
        time: 0,
        waveOffset: 0,
        gain: 50,
        sensitivity: 1,
        numberOfPoints: 12,
        viewportSize: simd_float2(400, 350)
    )
    
    private var wavePoints = WavePointsBuffer()
    private var subwavePoints = WavePointsBuffer()
    private var startTime: CFTimeInterval = 0
    
    // MARK: - Render Mode
    
    enum RenderMode {
        case jello
        case glow
        case siri
    }
    
    var renderMode: RenderMode = .jello
    
    // MARK: - Initialization
    
    init?(device: MTLDevice) {
        self.device = device
        
        guard let queue = device.makeCommandQueue() else {
            print("[MitsuhaMetalRenderer] ❌ Failed to create command queue")
            return nil
        }
        self.commandQueue = queue
        
        super.init()
        
        startTime = CACurrentMediaTime()
        
        if !setupPipelines() {
            print("[MitsuhaMetalRenderer] ❌ Failed to setup pipelines")
            return nil
        }
        
        setupBuffers()
        
        print("[MitsuhaMetalRenderer] ✅ Initialized with Metal device: \(device.name)")
    }
    
    // MARK: - Setup
    
    private func setupPipelines() -> Bool {
        // Cargar la librería de shaders
        guard let library = device.makeDefaultLibrary() else {
            print("[MitsuhaMetalRenderer] ❌ Failed to load shader library")
            return false
        }
        
        // Vertex shader (compartido)
        guard let vertexFunction = library.makeFunction(name: "mitsuhaVertexShader") else {
            print("[MitsuhaMetalRenderer] ❌ Failed to load vertex shader")
            return false
        }
        
        // Fragment shaders
        guard let jelloFragment = library.makeFunction(name: "mitsuhaJelloFragmentShader"),
              let glowFragment = library.makeFunction(name: "mitsuhaGlowFragmentShader"),
              let siriFragment = library.makeFunction(name: "mitsuhaSiriFragmentShader") else {
            print("[MitsuhaMetalRenderer] ❌ Failed to load fragment shaders")
            return false
        }
        
        // Pipeline descriptor base
        let pipelineDescriptor = MTLRenderPipelineDescriptor()
        pipelineDescriptor.vertexFunction = vertexFunction
        pipelineDescriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        
        // Configurar blending para transparencia
        pipelineDescriptor.colorAttachments[0].isBlendingEnabled = true
        pipelineDescriptor.colorAttachments[0].rgbBlendOperation = .add
        pipelineDescriptor.colorAttachments[0].alphaBlendOperation = .add
        pipelineDescriptor.colorAttachments[0].sourceRGBBlendFactor = .sourceAlpha
        pipelineDescriptor.colorAttachments[0].sourceAlphaBlendFactor = .sourceAlpha
        pipelineDescriptor.colorAttachments[0].destinationRGBBlendFactor = .oneMinusSourceAlpha
        pipelineDescriptor.colorAttachments[0].destinationAlphaBlendFactor = .oneMinusSourceAlpha
        
        do {
            // Pipeline Jello
            pipelineDescriptor.fragmentFunction = jelloFragment
            pipelineState = try device.makeRenderPipelineState(descriptor: pipelineDescriptor)
            
            // Pipeline Glow
            pipelineDescriptor.fragmentFunction = glowFragment
            glowPipelineState = try device.makeRenderPipelineState(descriptor: pipelineDescriptor)
            
            // Pipeline Siri
            pipelineDescriptor.fragmentFunction = siriFragment
            siriPipelineState = try device.makeRenderPipelineState(descriptor: pipelineDescriptor)
            
            print("[MitsuhaMetalRenderer] ✅ All pipelines created successfully")
            return true
        } catch {
            print("[MitsuhaMetalRenderer] ❌ Failed to create pipeline: \(error)")
            return false
        }
    }
    
    private func setupBuffers() {
        // Buffer de uniforms
        uniformsBuffer = device.makeBuffer(
            length: MemoryLayout<MitsuhaUniforms>.stride,
            options: .storageModeShared
        )
        
        // Buffers de puntos
        wavePointsBuffer = device.makeBuffer(
            length: MemoryLayout<WavePointsBuffer>.stride,
            options: .storageModeShared
        )
        
        subwavePointsBuffer = device.makeBuffer(
            length: MemoryLayout<WavePointsBuffer>.stride,
            options: .storageModeShared
        )
        
        print("[MitsuhaMetalRenderer] ✅ Buffers created")
    }
    
    // MARK: - Configuration
    
    func setColors(primary: UIColor, secondary: UIColor) {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        
        primary.getRed(&r, green: &g, blue: &b, alpha: &a)
        uniforms.waveColor = simd_float4(Float(r), Float(g), Float(b), Float(a))
        
        secondary.getRed(&r, green: &g, blue: &b, alpha: &a)
        uniforms.subwaveColor = simd_float4(Float(r), Float(g), Float(b), Float(a))
    }
    
    func setGain(_ gain: Float) {
        uniforms.gain = gain
    }
    
    func setSensitivity(_ sensitivity: Float) {
        uniforms.sensitivity = sensitivity
    }
    
    func setWaveOffset(_ offset: Float) {
        uniforms.waveOffset = offset
    }
    
    func setNumberOfPoints(_ count: Int) {
        uniforms.numberOfPoints = Int32(count)
    }
    
    // MARK: - Audio Data Update
    
    func updateWaveData(_ data: UnsafeMutablePointer<Float>, length: Int, viewSize: CGSize) {
        let pointCount = min(length, 64)
        let width = Float(viewSize.width)
        let height = Float(viewSize.height)
        let spacing = width / Float(max(pointCount - 1, 1))
        
        // Actualizar uniforms
        uniforms.viewportSize = simd_float2(Float(viewSize.width), Float(viewSize.height))
        uniforms.time = Float(CACurrentMediaTime() - startTime)
        
        // Actualizar puntos de la onda principal
        wavePoints.count = Int32(pointCount)
        
        for i in 0..<pointCount {
            let x = Float(i) * spacing
            let amplitude = data[i] * uniforms.gain * uniforms.sensitivity
            let y = height - uniforms.waveOffset - amplitude
            wavePoints.setPoint(at: i, point: simd_float2(x, max(0, min(height, y))))
        }
        
        // Subwave con delay (usando datos anteriores o reducidos)
        subwavePoints.count = Int32(pointCount)
        
        for i in 0..<pointCount {
            let x = Float(i) * spacing
            // Subwave es 80% de la amplitud con un pequeño offset
            let amplitude = data[i] * uniforms.gain * uniforms.sensitivity * 0.8
            let y = height - uniforms.waveOffset - amplitude + 5
            subwavePoints.setPoint(at: i, point: simd_float2(x, max(0, min(height, y))))
        }
    }
    
    // MARK: - Rendering
    
    func draw(in view: MTKView) {
        guard let drawable = view.currentDrawable,
              let renderPassDescriptor = view.currentRenderPassDescriptor,
              let commandBuffer = commandQueue.makeCommandBuffer(),
              let renderEncoder = commandBuffer.makeRenderCommandEncoder(descriptor: renderPassDescriptor) else {
            return
        }
        
        // Seleccionar pipeline según modo
        let pipeline: MTLRenderPipelineState?
        switch renderMode {
        case .jello:
            pipeline = pipelineState
        case .glow:
            pipeline = glowPipelineState
        case .siri:
            pipeline = siriPipelineState
        }
        
        guard let selectedPipeline = pipeline else { return }
        
        // Actualizar buffers
        updateBuffers()
        
        renderEncoder.setRenderPipelineState(selectedPipeline)
        
        // Bind buffers
        renderEncoder.setFragmentBuffer(uniformsBuffer, offset: 0, index: 0)
        renderEncoder.setFragmentBuffer(wavePointsBuffer, offset: 0, index: 1)
        renderEncoder.setFragmentBuffer(subwavePointsBuffer, offset: 0, index: 2)
        
        // Draw fullscreen quad
        renderEncoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 6)
        
        renderEncoder.endEncoding()
        
        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
    
    private func updateBuffers() {
        // Copiar uniforms al buffer
        if let buffer = uniformsBuffer {
            memcpy(buffer.contents(), &uniforms, MemoryLayout<MitsuhaUniforms>.stride)
        }
        
        // Copiar puntos al buffer
        if let buffer = wavePointsBuffer {
            memcpy(buffer.contents(), &wavePoints, MemoryLayout<WavePointsBuffer>.stride)
        }
        
        if let buffer = subwavePointsBuffer {
            memcpy(buffer.contents(), &subwavePoints, MemoryLayout<WavePointsBuffer>.stride)
        }
    }
}
