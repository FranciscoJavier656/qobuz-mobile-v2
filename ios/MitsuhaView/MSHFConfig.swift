import UIKit
import Accelerate

private func colorFromPropertyList(value: String) -> CGColor? {
    let parts = value.components(separatedBy: ":")
    let hexPart = parts.first?.filter({ $0 != "#" && $0 != " " }).uppercased()

    var alpha: CGFloat = 1.0
    if parts.count > 1, let alphaString = parts.last, let alphaValue = Float(alphaString) {
        alpha = CGFloat(alphaValue)
    }

    guard let hexString = hexPart, let hex = Int(hexString, radix: 16) else { return nil }

    let red, green, blue: CGFloat
    switch hexString.count {
    case 3:
        (red, green, blue) = (
            CGFloat((hex & 0xF00) >> 8) / 15.0,
            CGFloat((hex & 0x0F0) >> 4) / 15.0,
            CGFloat(hex & 0x00F) / 15.0
        )
    case 6:
        (red, green, blue) = (
            CGFloat((hex & 0xFF0000) >> 16) / 255.0,
            CGFloat((hex & 0x00FF00) >> 8) / 255.0,
            CGFloat(hex & 0x0000FF) / 255.0
        )
    default:
        return nil
    }

    return CGColor(red: red, green: green, blue: blue, alpha: alpha)
}

@objc (MSHFConfig) final public class MSHFConfig: NSObject {

    @objc private var enabled = false
    @objc private var style = 0
    @objc private var colorMode = 0
    @objc private var waveOffset: CGFloat = 0.0
    @objc private var waveOffsetOffset: CGFloat = 0.0
    @objc private var view: MSHFView?
    private var application: String?
    private var dynamicColorAlpha: CGFloat = 0.7
    private var waveColor: CGColor?
    private var calculatedColor: CGColor?
    private var prefs: [String: Any]

    @objc init(dictionary dict: [String: Any]) {
        prefs = dict
        if let app = prefs["application"] as? String {
            application = app
        }
        super.init()
        setDictionary()
    }

    @objc init(appName name: String) {
        application = name
        prefs = [:]
        super.init()
        parseConfig()
    }

    @objc public func initializeView(withFrame frame: CGRect) -> MSHFView? {
        let barSpacing = prefs["barSpacing"] as? CGFloat ?? 5
        let barCornerRadius = prefs["barCornerRadius"] as? CGFloat ?? 0
        let lineThickness = prefs["lineThickness"] as? CGFloat ?? 5

        view = switch style {
            case 1:
                MSHFBarView(frame: frame, barSpacing: barSpacing, barCornerRadius: barCornerRadius)
            case 2:
                MSHFLineView(frame: frame, lineThickness: lineThickness)
            case 3:
                MSHFDotView(frame: frame, barSpacing: barSpacing)
            case 4:
                MSHFSiriView(frame: frame)
            default:
                MSHFJelloView(frame: frame)
        }

        configureView()

        return view
    }

    private func configureView() {
        let view = view.unsafelyUnwrapped

        let fps = prefs["fps"] as? Float ?? 24
        view.displayLink!.preferredFrameRateRange = CAFrameRateRange(minimum: fps/2, maximum: fps, preferred: 0)
        if let numberOfPoints = prefs["numberOfPoints"] as? Int {
            view.numberOfPoints = numberOfPoints
        }
        view.waveOffset = waveOffset + waveOffsetOffset
        if let gain = prefs["gain"] as? Float {
            view.gain = gain
        }
        if let gain = prefs["limiter"] as? Float {
            view.limiter = gain
        }
        if let gain = prefs["sensitivity"] as? CGFloat {
            view.sensitivity = gain
        }
        if let enableFFT = prefs["enableFFT"] as? Bool {
            view.audioProcessing?.fft = enableFFT
        }
        if let disableBatterySaver = prefs["disableBatterySaver"] as? Bool {
            view.disableBatterySaver = disableBatterySaver
        }

        view.siriEnabled = colorMode == 1

        if let waveColor, colorMode == 2 {
            view.updateWave(waveColor, subwaveColor: waveColor)
        } else if colorMode == 1 {
            view.updateWave(waveColor, subwaveColor: waveColor, subSubwaveColor: waveColor)
        } else if let calculatedColor {
            view.updateWave(calculatedColor, subwaveColor: calculatedColor)
        }
    }

    /// Extrae el color dominante usando vImage (Accelerate Framework)
    /// Más preciso y eficiente que el método de escalado simple
    private func getDominantColorUsingVImage(from image: UIImage, withAlpha alpha: CGFloat) -> CGColor {
        guard let cgImage = image.cgImage else {
            return CGColor(gray: 0.5, alpha: alpha)
        }
        
        // Escalar imagen a tamaño pequeño para procesamiento rápido
        let targetSize = CGSize(width: 64, height: 64)
        
        // Configurar formato de imagen
        guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
            return getAverageColorFallback(from: image, withAlpha: alpha)
        }
        
        var format = vImage_CGImageFormat(
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            colorSpace: Unmanaged.passRetained(colorSpace),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue),
            version: 0,
            decode: nil,
            renderingIntent: .defaultIntent
        )
        
        // Crear buffer de origen
        var sourceBuffer = vImage_Buffer()
        var error = vImageBuffer_InitWithCGImage(&sourceBuffer, &format, nil, cgImage, vImage_Flags(kvImageNoFlags))
        
        guard error == kvImageNoError else {
            return getAverageColorFallback(from: image, withAlpha: alpha)
        }
        
        defer { free(sourceBuffer.data) }
        
        // Crear buffer de destino escalado
        var scaledBuffer = vImage_Buffer()
        scaledBuffer.width = vImagePixelCount(targetSize.width)
        scaledBuffer.height = vImagePixelCount(targetSize.height)
        scaledBuffer.rowBytes = Int(targetSize.width) * 4
        scaledBuffer.data = malloc(scaledBuffer.rowBytes * Int(targetSize.height))
        
        guard scaledBuffer.data != nil else {
            return getAverageColorFallback(from: image, withAlpha: alpha)
        }
        
        defer { free(scaledBuffer.data) }
        
        // Escalar imagen usando vImage
        error = vImageScale_ARGB8888(&sourceBuffer, &scaledBuffer, nil, vImage_Flags(kvImageHighQualityResampling))
        
        guard error == kvImageNoError else {
            return getAverageColorFallback(from: image, withAlpha: alpha)
        }
        
        // Calcular histogramas RGB
        var redHist = [vImagePixelCount](repeating: 0, count: 256)
        var greenHist = [vImagePixelCount](repeating: 0, count: 256)
        var blueHist = [vImagePixelCount](repeating: 0, count: 256)
        var alphaHist = [vImagePixelCount](repeating: 0, count: 256)
        
        error = redHist.withUnsafeMutableBufferPointer { rPtr in
            greenHist.withUnsafeMutableBufferPointer { gPtr in
                blueHist.withUnsafeMutableBufferPointer { bPtr in
                    alphaHist.withUnsafeMutableBufferPointer { aPtr in
                        var histograms: [UnsafeMutablePointer<vImagePixelCount>?] = [
                            rPtr.baseAddress, gPtr.baseAddress, bPtr.baseAddress, aPtr.baseAddress
                        ]
                        return vImageHistogramCalculation_ARGB8888(&scaledBuffer, &histograms, vImage_Flags(kvImageNoFlags))
                    }
                }
            }
        }
        
        guard error == kvImageNoError else {
            return getAverageColorFallback(from: image, withAlpha: alpha)
        }
        
        // Encontrar colores dominantes usando cuantización
        let dominantColor = findDominantColorFromHistograms(
            red: redHist,
            green: greenHist,
            blue: blueHist,
            buffer: &scaledBuffer
        )
        
        return CGColor(
            red: CGFloat(dominantColor.r) / 255.0,
            green: CGFloat(dominantColor.g) / 255.0,
            blue: CGFloat(dominantColor.b) / 255.0,
            alpha: alpha
        )
    }
    
    /// Encuentra el color dominante analizando los píxeles directamente
    private func findDominantColorFromHistograms(
        red: [vImagePixelCount],
        green: [vImagePixelCount],
        blue: [vImagePixelCount],
        buffer: inout vImage_Buffer
    ) -> (r: Int, g: Int, b: Int) {
        
        // Cuantizar colores en cubos de 32 niveles (8 valores por cubo)
        let bucketSize = 8
        let bucketsPerChannel = 256 / bucketSize
        let totalBuckets = bucketsPerChannel * bucketsPerChannel * bucketsPerChannel
        
        var buckets = [(r: CGFloat, g: CGFloat, b: CGFloat, count: Int, saturation: CGFloat)](
            repeating: (0, 0, 0, 0, 0),
            count: totalBuckets
        )
        
        let pixels = buffer.data.assumingMemoryBound(to: UInt8.self)
        let totalPixels = Int(buffer.width * buffer.height)
        
        for i in 0..<totalPixels {
            let offset = i * 4
            let r = Int(pixels[offset])
            let g = Int(pixels[offset + 1])
            let b = Int(pixels[offset + 2])
            let a = Int(pixels[offset + 3])
            
            // Ignorar píxeles transparentes
            if a < 128 { continue }
            
            let rBucket = r / bucketSize
            let gBucket = g / bucketSize
            let bBucket = b / bucketSize
            
            let bucketIndex = rBucket * bucketsPerChannel * bucketsPerChannel +
                              gBucket * bucketsPerChannel + bBucket
            
            if bucketIndex >= 0 && bucketIndex < totalBuckets {
                buckets[bucketIndex].r += CGFloat(r)
                buckets[bucketIndex].g += CGFloat(g)
                buckets[bucketIndex].b += CGFloat(b)
                buckets[bucketIndex].count += 1
            }
        }
        
        // Calcular promedios y saturación para cada cubo
        for i in 0..<totalBuckets {
            if buckets[i].count > 0 {
                let count = CGFloat(buckets[i].count)
                buckets[i].r /= count
                buckets[i].g /= count
                buckets[i].b /= count
                
                // Calcular saturación
                let maxC = max(buckets[i].r, max(buckets[i].g, buckets[i].b))
                let minC = min(buckets[i].r, min(buckets[i].g, buckets[i].b))
                buckets[i].saturation = maxC > 0 ? (maxC - minC) / maxC : 0
            }
        }
        
        // Ordenar por popularidad * saturación para preferir colores vibrantes
        let sortedBuckets = buckets.filter { $0.count > 0 }
            .sorted { ($0.count) * Int($0.saturation * 100 + 50) > ($1.count) * Int($1.saturation * 100 + 50) }
        
        // Retornar el color dominante más vibrante
        if let best = sortedBuckets.first {
            return (Int(best.r), Int(best.g), Int(best.b))
        }
        
        return (128, 128, 128)
    }
    
    /// Método de respaldo usando el escalado simple
    private func getAverageColorFallback(from image: UIImage, withAlpha alpha: CGFloat) -> CGColor {
        let size = CGSize(width: 1, height: 1)
        let renderer = UIGraphicsImageRenderer(size: size)

        let artwork = renderer.image { ctx in
            ctx.cgContext.interpolationQuality = .medium
            image.draw(in: CGRect(origin: .zero, size: size), blendMode: .copy, alpha: 1)
        }

        let data = UnsafeBufferPointer(start: CFDataGetBytePtr(artwork.cgImage?.dataProvider?.data), count: 4).map { CGFloat($0) }

        return CGColor(red: data[0] / 255.0, green: data[1] / 255.0, blue: data[2] / 255.0, alpha: alpha)
    }

    @objc public func colorizeView(_ image: UIImage?) {
        guard let view else {
            return
        }

        if colorMode == 1 {
            let color = CGColor(red: 1, green: 0, blue: 0, alpha: dynamicColorAlpha)
            let scolor = CGColor(red: 0, green: 1, blue: 0, alpha: dynamicColorAlpha)
            let sscolor = CGColor(red: 0, green: 0, blue: 1, alpha: dynamicColorAlpha)

            view.updateWave(color, subwaveColor: scolor, subSubwaveColor: sscolor)
        } else if let image, colorMode == 0 {
            // Usar vImage para extracción de color más precisa
            calculatedColor = getDominantColorUsingVImage(from: image, withAlpha: dynamicColorAlpha)
            view.updateWave(calculatedColor, subwaveColor: calculatedColor)
        } else {
            view.updateWave(waveColor, subwaveColor: waveColor)
        }
    }

    private func setDictionary() {
        enabled = prefs["enabled"] as? Bool ?? true

        style = prefs["style"] as? Int ?? 0
        colorMode = prefs["colorMode"] as? Int ?? 0
        if let colorAlpha = prefs["dynamicColorAlpha"] as? CGFloat {
            dynamicColorAlpha = colorAlpha
        }
        waveOffset = prefs["waveOffset"] as? CGFloat ?? 0
        if let hexString = prefs["waveColor"] as? String, let color = colorFromPropertyList(value: hexString) {
            waveColor = color
        } else {
            waveColor = CGColor(gray: 0.5, alpha: 0.5)
        }
    }

    private func parseConfig() {
        guard let name = self.application else {
            return
        }

        if NSHomeDirectory() == "/var/mobile", let file = UserDefaults(suiteName: "com.ryannair05.mitsuhasix") {
            let prefPrefix = "MSHF" + name
            let dropCount = prefPrefix.count

            for (key, value) in file.dictionaryRepresentation() where key.hasPrefix(prefPrefix) {
                let removedKey = key.dropFirst(dropCount)
                let lowerCaseKey = removedKey.prefix(1).lowercased() + removedKey.dropFirst()

                prefs[lowerCaseKey] = value
            }
        } else {
            let MSHFPrefsFile = "/var/jb/var/mobile/Library/Preferences/com.ryannair05.mitsuhasix.plist"

            if let file = NSDictionary(contentsOfFile: MSHFPrefsFile) {
                let prefPrefix = "MSHF" + name
                let dropCount = prefPrefix.count

                for (key, value) in file {
                    guard let key = key as? String, key.hasPrefix(prefPrefix) else {
                        continue
                    }

                    let removedKey = key.dropFirst(dropCount)
                    let lowerCaseKey = removedKey.prefix(1).lowercased() + removedKey.dropFirst()

                    prefs[lowerCaseKey] = value
                }
            }
        }

        setDictionary()
    }

    @objc private func reload() {
        parseConfig()
        configureView()
    }
}
