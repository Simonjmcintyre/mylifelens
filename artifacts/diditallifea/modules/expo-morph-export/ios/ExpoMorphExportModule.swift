import ExpoModulesCore
import AVFoundation
import CoreImage
import ImageIO
import UIKit

public class ExpoMorphExportModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoMorphExport")
    AsyncFunction("exportMorph") { (options: [String: Any]) throws -> [String: Any] in
      guard let rawFrames = options["frames"] as? [[String: Any]], rawFrames.count > 0 else {
        throw NSError(domain: "ExpoMorphExport", code: 1, userInfo: [NSLocalizedDescriptionKey: "At least one real photo is required."])
      }
      let width = max(320, min(1080, (options["width"] as? Int) ?? 720))
      let height = max(320, min(1080, (options["height"] as? Int) ?? 720))
      let fps = max(12, min(30, (options["fps"] as? Int) ?? 24))
      let speed = max(0.5, min(2, (options["speed"] as? Double) ?? 1))
      let holdFrames = max(1, Int(Double(fps) * ((options["holdSeconds"] as? Double) ?? 0.7) / speed))
      let transitionFrames = max(1, Int(Double(fps) * ((options["transitionSeconds"] as? Double) ?? 1.1) / speed))
      let frames = try rawFrames.map { try MorphSource($0) }
      let outputURL = FileManager.default.temporaryDirectory.appendingPathComponent("mylifelens-\(UUID().uuidString).mp4")
      let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
      defer {
        if writer.status != .completed {
          writer.cancelWriting()
          try? FileManager.default.removeItem(at: outputURL)
        }
      }
      let settings: [String: Any] = [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
        AVVideoCompressionPropertiesKey: [
          AVVideoAverageBitRateKey: min(8_000_000, max(1_500_000, width * height * 4)),
          AVVideoProfileLevelKey: AVVideoProfileLevelH264MainAutoLevel
        ]
      ]
      let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
      input.expectsMediaDataInRealTime = false
      let adaptor = AVAssetWriterInputPixelBufferAdaptor(
        assetWriterInput: input,
        sourcePixelBufferAttributes: [
          kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
          kCVPixelBufferWidthKey as String: width,
          kCVPixelBufferHeightKey as String: height
        ])
      writer.add(input)
      writer.startWriting()
      writer.startSession(atSourceTime: .zero)
      let context = CIContext(options: [.useSoftwareRenderer: false])
      let watermark = try makeWatermark(width: width, height: height)
      var frameIndex = 0
      func append(_ image: CIImage, _ timestamp: CMTime) throws {
        while !input.isReadyForMoreMediaData {
          if writer.status == .failed || writer.status == .cancelled {
            throw writer.error ?? NSError(domain: "ExpoMorphExport", code: 6, userInfo: [NSLocalizedDescriptionKey: "The video writer stopped unexpectedly."])
          }
          Thread.sleep(forTimeInterval: 0.002)
        }
        var pixel: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pixel)
        guard let buffer = pixel else { throw NSError(domain: "ExpoMorphExport", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not allocate a video frame."]) }
        context.render(image, to: buffer, bounds: CGRect(x: 0, y: 0, width: width, height: height), colorSpace: CGColorSpaceCreateDeviceRGB())
        if !adaptor.append(buffer, withPresentationTime: timestamp) { throw writer.error ?? NSError(domain: "ExpoMorphExport", code: 3) }
        frameIndex += 1
      }
      for index in 0..<frames.count {
        let current = frames[index]
        let next = index + 1 < frames.count ? frames[index + 1] : nil
        for _ in 0..<holdFrames { try append(render(current, next: nil, progress: 0, width: width, height: height, context: context, watermark: watermark), CMTime(value: CMTimeValue(frameIndex), timescale: CMTimeScale(fps))) }
        if let next {
          for step in 1...transitionFrames {
            let progress = CGFloat(step) / CGFloat(transitionFrames)
            try append(render(current, next: next, progress: progress, width: width, height: height, context: context, watermark: watermark), CMTime(value: CMTimeValue(frameIndex), timescale: CMTimeScale(fps)))
          }
        }
      }
      input.markAsFinished()
      let semaphore = DispatchSemaphore(value: 0)
      writer.finishWriting { semaphore.signal() }
      semaphore.wait()
      guard writer.status == .completed else { throw writer.error ?? NSError(domain: "ExpoMorphExport", code: 4, userInfo: [NSLocalizedDescriptionKey: "Video export failed."]) }
      return ["uri": outputURL.absoluteString, "duration": Double(frameIndex) / Double(fps)]
    }
    AsyncFunction("exportWatermarkedImage") { (options: [String: Any]) throws -> [String: Any] in
      guard let uri = options["uri"] as? String,
            let inputURL = URL(string: uri),
            let source = UIImage(contentsOfFile: inputURL.path) else {
        throw NSError(domain: "ExpoMorphExport", code: 7, userInfo: [NSLocalizedDescriptionKey: "The shared photo could not be read."])
      }
      let maxDimension: CGFloat = 2160
      let reduction = min(1, maxDimension / max(source.size.width, source.size.height))
      let size = CGSize(width: floor(source.size.width * reduction), height: floor(source.size.height * reduction))
      let watermark = try watermarkUIImage(width: Int(size.width), height: Int(size.height))
      let resultFormat = UIGraphicsImageRendererFormat()
      resultFormat.scale = 1
      resultFormat.opaque = true
      let renderer = UIGraphicsImageRenderer(size: size, format: resultFormat)
      let result = renderer.image { _ in
        source.draw(in: CGRect(origin: .zero, size: size))
        watermark.draw(in: CGRect(origin: .zero, size: size))
      }
      guard let data = result.jpegData(compressionQuality: 0.94) else {
        throw NSError(domain: "ExpoMorphExport", code: 8, userInfo: [NSLocalizedDescriptionKey: "The shared photo could not be encoded."])
      }
      let outputURL = FileManager.default.temporaryDirectory.appendingPathComponent("mylifelens-\(UUID().uuidString).jpg")
      try data.write(to: outputURL, options: .atomic)
      return ["uri": outputURL.absoluteString]
    }
  }
}

private struct MorphSource {
  let image: CIImage
  let x: CGFloat
  let y: CGFloat
  let scale: CGFloat
  init(_ value: [String: Any]) throws {
    guard let uri = value["uri"] as? String, let url = URL(string: uri), let oriented = CIImage(contentsOf: url, options: [.applyOrientationProperty: true]) else {
      throw NSError(domain: "ExpoMorphExport", code: 5, userInfo: [NSLocalizedDescriptionKey: "A progress photo could not be read."])
    }
    image = oriented
    x = (value["x"] as? CGFloat) ?? CGFloat((value["x"] as? Double) ?? 0)
    y = (value["y"] as? CGFloat) ?? CGFloat((value["y"] as? Double) ?? 0)
    scale = (value["scale"] as? CGFloat) ?? CGFloat((value["scale"] as? Double) ?? 1)
  }
}

private func render(_ current: MorphSource, next: MorphSource?, progress: CGFloat, width: Int, height: Int, context: CIContext, watermark: CIImage) -> CIImage {
  func compose(_ source: MorphSource) -> CIImage {
    let canvas = CGRect(x: 0, y: 0, width: width, height: height)
    let extent = source.image.extent
    let cover = max(CGFloat(width) / extent.width, CGFloat(height) / extent.height)
    let image = source.image.transformed(by: CGAffineTransform(scaleX: cover, y: cover))
    let centeredRect = CGRect(x: image.extent.midX - CGFloat(width) / 2, y: image.extent.midY - CGFloat(height) / 2, width: CGFloat(width), height: CGFloat(height))
    let crop = image.cropped(to: centeredRect).transformed(by: CGAffineTransform(translationX: -centeredRect.minX, y: -centeredRect.minY))
    let blur = crop.clampedToExtent().applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 22]).cropped(to: canvas)
    let foregroundScale = source.image.transformed(by: CGAffineTransform(scaleX: cover * source.scale, y: cover * source.scale))
    let foregroundRect = CGRect(x: foregroundScale.extent.midX - CGFloat(width) / 2, y: foregroundScale.extent.midY - CGFloat(height) / 2, width: CGFloat(width), height: CGFloat(height))
    let foreground = foregroundScale
      .cropped(to: foregroundRect)
      .transformed(by: CGAffineTransform(translationX: -foregroundRect.minX + source.x * CGFloat(width), y: -foregroundRect.minY - source.y * CGFloat(height)))
      .cropped(to: canvas)
    return foreground.composited(over: blur)
  }
  let first = compose(current)
  let blended: CIImage
  if let next {
    let second = compose(next)
    let fadedSecond = second.applyingFilter("CIColorMatrix", parameters: [
      "inputAVector": CIVector(x: 0, y: 0, z: 0, w: progress)
    ])
    blended = fadedSecond.composited(over: first)
  } else {
    blended = first
  }
  return watermark.composited(over: blended)
}

private func canvas(_ width: Int, _ height: Int) -> CGRect {
  CGRect(x: 0, y: 0, width: width, height: height)
}

private func watermarkUIImage(width: Int, height: Int) throws -> UIImage {
  let bundle = Bundle(for: ExpoMorphExportModule.self)
  guard let icon = UIImage(named: "mylifelens_watermark_icon", in: bundle, compatibleWith: nil)
          ?? UIImage(named: "mylifelens_watermark_icon") else {
    throw NSError(domain: "ExpoMorphExport", code: 9, userInfo: [NSLocalizedDescriptionKey: "The MyLifelens watermark icon could not be loaded."])
  }
  guard let wordmark = UIImage(named: "mylifelens_watermark_wordmark", in: bundle, compatibleWith: nil)
          ?? UIImage(named: "mylifelens_watermark_wordmark") else {
    throw NSError(domain: "ExpoMorphExport", code: 11, userInfo: [NSLocalizedDescriptionKey: "The MyLifelens wordmark could not be loaded."])
  }
  let scale = min(CGFloat(width) / 656, CGFloat(height) / 720)
  let edge = 24 * scale
  let padding = 9 * scale
  let iconSize = 40 * scale
  let gap = 10 * scale
  let wordmarkHeight = 19 * scale
  let wordmarkWidth = wordmarkHeight * wordmark.size.width / wordmark.size.height
  let pillSize = CGSize(width: padding + iconSize + gap + wordmarkWidth + 14 * scale, height: iconSize + padding * 2)
  let format = UIGraphicsImageRendererFormat()
  format.scale = 1
  format.opaque = false
  let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format)
  return renderer.image { context in
    let rect = CGRect(x: edge, y: CGFloat(height) - edge - pillSize.height, width: pillSize.width, height: pillSize.height)
    UIColor(red: 7.0 / 255.0, green: 17.0 / 255.0, blue: 31.0 / 255.0, alpha: 0.72).setFill()
    UIBezierPath(roundedRect: rect, cornerRadius: 12 * scale).fill()
    icon.draw(in: CGRect(x: rect.minX + padding, y: rect.minY + padding, width: iconSize, height: iconSize))
    wordmark.draw(in: CGRect(x: rect.minX + padding + iconSize + gap, y: rect.midY - wordmarkHeight / 2, width: wordmarkWidth, height: wordmarkHeight))
    context.cgContext.flush()
  }
}

private func makeWatermark(width: Int, height: Int) throws -> CIImage {
  guard let image = CIImage(image: try watermarkUIImage(width: width, height: height)) else {
    throw NSError(domain: "ExpoMorphExport", code: 10, userInfo: [NSLocalizedDescriptionKey: "The MyLifelens watermark could not be rendered."])
  }
  return image.cropped(to: canvas(width, height))
}