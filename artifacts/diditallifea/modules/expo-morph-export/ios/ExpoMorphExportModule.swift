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
        for _ in 0..<holdFrames { try append(render(current, next: nil, progress: 0, width: width, height: height, context: context), CMTime(value: CMTimeValue(frameIndex), timescale: CMTimeScale(fps))) }
        if let next {
          for step in 1...transitionFrames {
            let progress = CGFloat(step) / CGFloat(transitionFrames)
            try append(render(current, next: next, progress: progress, width: width, height: height, context: context), CMTime(value: CMTimeValue(frameIndex), timescale: CMTimeScale(fps)))
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

private func render(_ current: MorphSource, next: MorphSource?, progress: CGFloat, width: Int, height: Int, context: CIContext) -> CIImage {
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
  guard let next else { return first }
  let second = compose(next)
  return second.applyingFilter("CIBlendWithAlphaMask", parameters: [
    kCIInputBackgroundImageKey: first,
    kCIInputMaskImageKey: CIImage(color: CIColor(red: progress, green: progress, blue: progress)).cropped(to: canvas(width, height))
  ])
}

private func canvas(_ width: Int, _ height: Int) -> CGRect {
  CGRect(x: 0, y: 0, width: width, height: height)
}