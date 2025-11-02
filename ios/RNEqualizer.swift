import Foundation
import AVFoundation

@objc(RNEqualizer)
class RNEqualizer: NSObject {
    
    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var eqNode: AVAudioUnitEQ?
    private var audioFile: AVAudioFile?
    private var isEnabled: Bool = false
    
    // Estado del reproductor
    private var isPlaying: Bool = false
    private var duration: TimeInterval = 0.0
    private var currentTime: TimeInterval = 0.0
    private var volume: Float = 1.0
    
    // Timer para tracking de posición
    private var displayLink: CADisplayLink?
    private var lastFrameTime: TimeInterval = 0.0
    
    // 10 bandas de frecuencia para el ecualizador
    private let frequencies: [Float] = [32, 55, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
    
    override init() {
        super.init()
        setupAudioEngine()
    }
    
    private func setupAudioEngine() {
        audioEngine = AVAudioEngine()
        playerNode = AVAudioPlayerNode()
        
        // Crear ecualizador con 10 bandas
        eqNode = AVAudioUnitEQ(numberOfBands: 10)
        
        guard let audioEngine = audioEngine,
              let playerNode = playerNode,
              let eqNode = eqNode else {
            print("[RNEqualizer] ❌ Error inicializando audio engine")
            return
        }
        
        // Configurar cada banda de frecuencia
        for (index, frequency) in frequencies.enumerated() {
            let band = eqNode.bands[index]
            band.frequency = frequency
            band.bandwidth = 0.5
            band.bypass = false
            band.filterType = .parametric
        }
        
        // Adjuntar nodos al engine
        audioEngine.attach(playerNode)
        audioEngine.attach(eqNode)
        
        // Conectar: playerNode -> eqNode -> mainMixerNode -> output
        let format = audioEngine.mainMixerNode.outputFormat(forBus: 0)
        audioEngine.connect(playerNode, to: eqNode, format: format)
        audioEngine.connect(eqNode, to: audioEngine.mainMixerNode, format: format)
        
        print("[RNEqualizer] ✅ Audio engine configurado con 10 bandas")
    }
    
    @objc
    func initialize(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let audioEngine = self.audioEngine else {
                reject("ERROR", "Audio engine no inicializado", nil)
                return
            }
            
            do {
                try audioEngine.start()
                self.isEnabled = true
                print("[RNEqualizer] ✅ Ecualizador inicializado correctamente")
                resolve(true)
            } catch {
                print("[RNEqualizer] ❌ Error iniciando audio engine: \(error)")
                reject("ERROR", "No se pudo iniciar el audio engine: \(error.localizedDescription)", error)
            }
        }
    }
    
    @objc
    func enable(_ enabled: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let eqNode = self.eqNode else {
                reject("ERROR", "Ecualizador no configurado", nil)
                return
            }
            
            eqNode.bypass = !enabled
            self.isEnabled = enabled
            
            print("[RNEqualizer] \(enabled ? "✅ Habilitado" : "🔇 Deshabilitado")")
            resolve(nil)
        }
    }
    
    @objc
    func setBandLevel(_ bandIndex: Int, level: Float, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let eqNode = self.eqNode else {
                reject("ERROR", "Ecualizador no configurado", nil)
                return
            }
            
            guard bandIndex >= 0 && bandIndex < self.frequencies.count else {
                reject("ERROR", "Índice de banda inválido: \(bandIndex)", nil)
                return
            }
            
            let band = eqNode.bands[bandIndex]
            band.gain = level // Directamente en dB (-20 a +20)
            
            print("[RNEqualizer] 🎛️ Banda \(bandIndex) (\(self.frequencies[bandIndex])Hz) -> \(level)dB")
            resolve(nil)
        }
    }
    
    @objc
    func getBandLevelRange(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        // AVAudioUnitEQ soporta -96 a +24 dB, pero nosotros usaremos -20 a +20
        resolve([-20.0, 20.0])
    }
    
    @objc
    func getNumberOfBands(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        resolve(frequencies.count)
    }
    
    @objc
    func getCenterFreq(_ bandIndex: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard bandIndex >= 0 && bandIndex < frequencies.count else {
            reject("ERROR", "Índice de banda inválido", nil)
            return
        }
        
        resolve(frequencies[bandIndex])
    }
    
    // MARK: - Audio Player Methods
    
    @objc
    func loadAudio(_ uri: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            do {
                // Detener reproducción actual
                self.playerNode?.stop()
                self.stopPositionTracking()
                
                // Limpiar prefijo file://
                let filePath = uri.replacingOccurrences(of: "file://", with: "")
                
                // Decodificar URL encoding
                guard let decodedPath = filePath.removingPercentEncoding else {
                    reject("ERROR", "No se pudo decodificar la ruta", nil)
                    return
                }
                
                let fileURL = URL(fileURLWithPath: decodedPath)
                
                print("[RNEqualizer] 📂 Cargando: \(fileURL.lastPathComponent)")
                
                // Cargar archivo de audio
                self.audioFile = try AVAudioFile(forReading: fileURL)
                
                guard let audioFile = self.audioFile else {
                    reject("ERROR", "No se pudo cargar el archivo de audio", nil)
                    return
                }
                
                // Calcular duración
                let sampleRate = audioFile.processingFormat.sampleRate
                let frameCount = Double(audioFile.length)
                self.duration = frameCount / sampleRate
                self.currentTime = 0.0
                
                print("[RNEqualizer] ✅ Audio cargado - Duración: \(self.duration)s")
                
                resolve([
                    "duration": self.duration * 1000, // En milisegundos
                    "uri": uri
                ])
                
            } catch {
                print("[RNEqualizer] ❌ Error cargando audio: \(error)")
                reject("ERROR", error.localizedDescription, error)
            }
        }
    }
    
    @objc
    func play(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerNode = self.playerNode,
                  let audioFile = self.audioFile else {
                reject("ERROR", "No hay audio cargado", nil)
                return
            }
            
            do {
                if !self.isPlaying {
                    // Iniciar audio engine si no está corriendo
                    if let audioEngine = self.audioEngine, !audioEngine.isRunning {
                        try audioEngine.start()
                    }
                    
                    // Programar archivo para reproducción
                    playerNode.scheduleFile(audioFile, at: nil) {
                        DispatchQueue.main.async {
                            print("[RNEqualizer] 🎵 Reproducción finalizada")
                            self.isPlaying = false
                            self.stopPositionTracking()
                            // TODO: Enviar evento a React Native
                        }
                    }
                    
                    // Iniciar reproducción
                    playerNode.play()
                    self.isPlaying = true
                    self.startPositionTracking()
                    
                    print("[RNEqualizer] ▶️ Reproduciendo")
                }
                
                resolve(nil)
            } catch {
                print("[RNEqualizer] ❌ Error reproduciendo: \(error)")
                reject("ERROR", error.localizedDescription, error)
            }
        }
    }
    
    @objc
    func pause(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerNode = self.playerNode else {
                reject("ERROR", "Player no inicializado", nil)
                return
            }
            
            if self.isPlaying {
                playerNode.pause()
                self.isPlaying = false
                self.stopPositionTracking()
                print("[RNEqualizer] ⏸️ Pausado")
            }
            
            resolve(nil)
        }
    }
    
    @objc
    func stop(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerNode = self.playerNode else {
                reject("ERROR", "Player no inicializado", nil)
                return
            }
            
            playerNode.stop()
            self.isPlaying = false
            self.currentTime = 0.0
            self.stopPositionTracking()
            print("[RNEqualizer] ⏹️ Detenido")
            
            resolve(nil)
        }
    }
    
    @objc
    func setVolume(_ volume: Float, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerNode = self.playerNode else {
                reject("ERROR", "Player no inicializado", nil)
                return
            }
            
            let clampedVolume = max(0.0, min(1.0, volume))
            playerNode.volume = clampedVolume
            self.volume = clampedVolume
            
            resolve(nil)
        }
    }
    
    @objc
    func getStatus(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            resolve([
                "isPlaying": self.isPlaying,
                "positionMillis": self.currentTime * 1000,
                "durationMillis": self.duration * 1000,
                "volume": self.volume
            ])
        }
    }
    
    @objc
    func seekTo(_ positionMs: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard let playerNode = self.playerNode,
                  let audioFile = self.audioFile else {
                reject("ERROR", "No hay audio cargado", nil)
                return
            }
            
            let wasPlaying = self.isPlaying
            
            // Detener reproducción actual
            playerNode.stop()
            self.stopPositionTracking()
            
            // Calcular frame de inicio
            let targetTime = positionMs / 1000.0
            let sampleRate = audioFile.processingFormat.sampleRate
            let startFrame = AVAudioFramePosition(targetTime * sampleRate)
            
            // Validar frame
            guard startFrame >= 0 && startFrame < audioFile.length else {
                reject("ERROR", "Posición inválida", nil)
                return
            }
            
            self.currentTime = targetTime
            
            // Reanudar si estaba reproduciendo
            if wasPlaying {
                do {
                    // Programar desde la nueva posición
                    playerNode.scheduleSegment(audioFile, 
                                              startingFrame: startFrame, 
                                              frameCount: AVAudioFrameCount(audioFile.length - startFrame), 
                                              at: nil) {
                        DispatchQueue.main.async {
                            self.isPlaying = false
                            self.stopPositionTracking()
                        }
                    }
                    
                    playerNode.play()
                    self.isPlaying = true
                    self.startPositionTracking()
                    
                    print("[RNEqualizer] ⏩ Seek a \(targetTime)s")
                } catch {
                    reject("ERROR", error.localizedDescription, error)
                    return
                }
            }
            
            resolve(nil)
        }
    }
    
    // MARK: - Position Tracking
    
    private func startPositionTracking() {
        stopPositionTracking()
        
        displayLink = CADisplayLink(target: self, selector: #selector(updatePosition))
        displayLink?.add(to: .main, forMode: .common)
        lastFrameTime = CACurrentMediaTime()
    }
    
    private func stopPositionTracking() {
        displayLink?.invalidate()
        displayLink = nil
    }
    
    @objc private func updatePosition() {
        guard isPlaying else { return }
        
        let currentFrameTime = CACurrentMediaTime()
        let elapsed = currentFrameTime - lastFrameTime
        lastFrameTime = currentFrameTime
        
        currentTime += elapsed
        
        // Limitar a la duración total
        if currentTime >= duration {
            currentTime = duration
        }
    }
}
