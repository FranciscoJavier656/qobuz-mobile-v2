/**
 * MitsuhaMetalView.swift
 * Vista de Metal para el visualizador Mitsuha
 * 
 * Wrapper de MTKView que maneja el ciclo de renderizado y la integración con Core Animation
 */

import UIKit
import MetalKit

@objc public protocol MitsuhaMetalViewDelegate: AnyObject {
    @objc optional func metalViewDidStartRendering(_ view: MitsuhaMetalView)
    @objc optional func metalViewDidStopRendering(_ view: MitsuhaMetalView)
}

@objc public class MitsuhaMetalView: UIView {
    
    // MARK: - Properties
    
    private var metalView: MTKView?
    private var renderer: MitsuhaMetalRenderer?
    private var device: MTLDevice?
    
    @objc public weak var delegate: MitsuhaMetalViewDelegate?
    
    // Configuración
    @objc public var numberOfPoints: Int = 12 {
        didSet { renderer?.setNumberOfPoints(numberOfPoints) }
    }
    
    @objc public var gain: Float = 50 {
        didSet { renderer?.setGain(gain) }
    }
    
    @objc public var sensitivity: Float = 1.0 {
        didSet { renderer?.setSensitivity(sensitivity) }
    }
    
    @objc public var waveOffset: Float = 0 {
        didSet { renderer?.setWaveOffset(waveOffset) }
    }
    
    @objc public var waveColor: UIColor = .systemBlue {
        didSet { updateColors() }
    }
    
    @objc public var subwaveColor: UIColor = UIColor.systemBlue.withAlphaComponent(0.6) {
        didSet { updateColors() }
    }
    
    private var _isPlaying: Bool = false
    @objc public var isPlaying: Bool {
        get { _isPlaying }
        set {
            guard _isPlaying != newValue else { return }
            _isPlaying = newValue
            
            if newValue {
                startRendering()
            } else {
                stopRendering()
            }
        }
    }
    
    // Buffer de audio
    private var audioBuffer: UnsafeMutablePointer<Float>?
    private var bufferLength: Int = 0
    
    // Estado de Metal
    private var isMetalAvailable: Bool {
        return device != nil && renderer != nil
    }
    
    // Fallback a Core Animation si Metal no está disponible
    private var fallbackJelloView: MSHFJelloView?
    
    // MARK: - Initialization
    
    override public init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }
    
    required public init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }
    
    private func setup() {
        backgroundColor = .clear
        
        // Intentar inicializar Metal
        if let metalDevice = MTLCreateSystemDefaultDevice() {
            device = metalDevice
            setupMetal(with: metalDevice)
            print("[MitsuhaMetalView] ✅ Metal initialized: \(metalDevice.name)")
        } else {
            print("[MitsuhaMetalView] ⚠️ Metal not available, using Core Animation fallback")
            setupFallback()
        }
    }
    
    private func setupMetal(with device: MTLDevice) {
        // Crear MTKView
        let mtkView = MTKView(frame: bounds, device: device)
        mtkView.backgroundColor = .clear
        mtkView.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 0)
        mtkView.isOpaque = false
        mtkView.layer.isOpaque = false
        mtkView.framebufferOnly = true
        mtkView.preferredFramesPerSecond = 60
        mtkView.isPaused = true // Empezar pausado
        mtkView.enableSetNeedsDisplay = false
        mtkView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        
        // Crear renderer
        guard let metalRenderer = MitsuhaMetalRenderer(device: device) else {
            print("[MitsuhaMetalView] ❌ Failed to create renderer")
            setupFallback()
            return
        }
        
        renderer = metalRenderer
        metalView = mtkView
        
        // Asignar delegate
        mtkView.delegate = self
        
        addSubview(mtkView)
        
        // Configuración inicial
        updateColors()
        renderer?.setNumberOfPoints(numberOfPoints)
        renderer?.setGain(gain)
        renderer?.setSensitivity(sensitivity)
        renderer?.setWaveOffset(waveOffset)
    }
    
    private func setupFallback() {
        // Usar MSHFJelloView como fallback
        guard let jelloView = MSHFJelloView(frame: bounds) else {
            print("[MitsuhaMetalView] ❌ No se pudo crear MSHFJelloView fallback")
            return
        }
        
        jelloView.numberOfPoints = numberOfPoints
        jelloView.gain = gain
        jelloView.sensitivity = CGFloat(sensitivity)
        jelloView.waveOffset = CGFloat(waveOffset)
        jelloView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        
        fallbackJelloView = jelloView
        addSubview(jelloView)
        
        updateFallbackColors()
    }
    
    // MARK: - Layout
    
    override public func layoutSubviews() {
        super.layoutSubviews()
        metalView?.frame = bounds
        fallbackJelloView?.frame = bounds
    }
    
    // MARK: - Colors
    
    private func updateColors() {
        renderer?.setColors(primary: waveColor, secondary: subwaveColor)
        updateFallbackColors()
    }
    
    private func updateFallbackColors() {
        fallbackJelloView?.updateWave(waveColor.cgColor, subwaveColor: subwaveColor.cgColor)
    }
    
    // MARK: - Audio Data
    
    @objc public func updateBuffer(_ data: UnsafeMutablePointer<Float>, length: Int32) {
        let len = Int(length)
        
        // Asegurar que tenemos buffer del tamaño correcto
        if audioBuffer == nil || bufferLength != len {
            audioBuffer?.deallocate()
            audioBuffer = UnsafeMutablePointer<Float>.allocate(capacity: len)
            bufferLength = len
        }
        
        // Copiar datos
        memcpy(audioBuffer, data, len * MemoryLayout<Float>.stride)
        
        // Actualizar renderer o fallback
        if isMetalAvailable {
            renderer?.updateWaveData(audioBuffer!, length: len, viewSize: bounds.size)
        } else {
            fallbackJelloView?.updateBuffer(data, withLength: length)
        }
    }
    
    // MARK: - Rendering Control
    
    private func startRendering() {
        if isMetalAvailable {
            metalView?.isPaused = false
            delegate?.metalViewDidStartRendering?(self)
            print("[MitsuhaMetalView] ▶️ Metal rendering started")
        } else {
            fallbackJelloView?.start()
            print("[MitsuhaMetalView] ▶️ Fallback rendering started")
        }
    }
    
    private func stopRendering() {
        if isMetalAvailable {
            metalView?.isPaused = true
            delegate?.metalViewDidStopRendering?(self)
            print("[MitsuhaMetalView] ⏸ Metal rendering paused")
        } else {
            fallbackJelloView?.stop()
            print("[MitsuhaMetalView] ⏸ Fallback rendering paused")
        }
    }
    
    @objc public func start() {
        isPlaying = true
    }
    
    @objc public func stop() {
        isPlaying = false
    }
    
    // MARK: - Render Mode
    
    @objc public enum VisualizerStyle: Int {
        case jello = 0
        case glow = 1
        case siri = 2
    }
    
    @objc public var visualizerStyle: VisualizerStyle = .jello {
        didSet {
            switch visualizerStyle {
            case .jello:
                renderer?.renderMode = .jello
            case .glow:
                renderer?.renderMode = .glow
            case .siri:
                renderer?.renderMode = .siri
            }
        }
    }
    
    // MARK: - Cleanup
    
    deinit {
        audioBuffer?.deallocate()
        print("[MitsuhaMetalView] 🗑 Deinitialized")
    }
}

// MARK: - MTKViewDelegate

extension MitsuhaMetalView: MTKViewDelegate {
    
    public func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        // El tamaño cambió, actualizar si es necesario
    }
    
    public func draw(in view: MTKView) {
        guard isPlaying else { return }
        renderer?.draw(in: view)
    }
}

// MARK: - React Native Compatibility

extension MitsuhaMetalView {
    
    /// Actualiza colores desde strings hex (para React Native)
    @objc public func setColorsFromHex(primary: String, secondary: String?) {
        waveColor = UIColor(hexString: primary) ?? .systemBlue
        
        if let sec = secondary {
            subwaveColor = UIColor(hexString: sec) ?? waveColor.withAlphaComponent(0.6)
        } else {
            subwaveColor = waveColor.withAlphaComponent(0.6)
        }
    }
}

// MARK: - UIColor Extension

private extension UIColor {
    convenience init?(hexString: String) {
        var hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if hex.hasPrefix("#") {
            hex.removeFirst()
        }
        
        guard hex.count == 6 else { return nil }
        
        var rgbValue: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&rgbValue)
        
        self.init(
            red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0,
            green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0,
            blue: CGFloat(rgbValue & 0x0000FF) / 255.0,
            alpha: 1.0
        )
    }
}
