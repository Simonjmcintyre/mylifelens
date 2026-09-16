package expo.modules.morphexport

import android.graphics.*
import android.graphics.Matrix as GraphicsMatrix
import android.media.*
import android.net.Uri
import android.opengl.*
import android.view.Surface
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayInputStream
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.io.File
import java.util.UUID
import kotlin.concurrent.thread

class ExpoMorphExportModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoMorphExport")
    AsyncFunction("exportMorph") { options: Map<String, Any?>, promise: Promise ->
      thread {
        try {
          val raw = options["frames"] as? List<*> ?: throw Exception("At least one real photo is required.")
          if (raw.isEmpty()) throw Exception("At least one real photo is required.")
          val width = ((options["width"] as? Number)?.toInt() ?: 720).coerceIn(320, 1080)
          val height = ((options["height"] as? Number)?.toInt() ?: 720).coerceIn(320, 1080)
          val fps = ((options["fps"] as? Number)?.toInt() ?: 24).coerceIn(12, 30)
          val speed = ((options["speed"] as? Number)?.toDouble() ?: 1.0).coerceIn(.5, 2.0)
          val hold = ((fps * ((options["holdSeconds"] as? Number)?.toDouble() ?: .7)) / speed).toInt().coerceAtLeast(1)
          val transition = ((fps * ((options["transitionSeconds"] as? Number)?.toDouble() ?: 1.1)) / speed).toInt().coerceAtLeast(1)
          val frames = raw.map { MorphSource.from(it as Map<*, *>) }
          val out = File(appContext.reactContext!!.cacheDir, "mylifelens-${UUID.randomUUID()}.mp4")
          val frameCount = frames.size * hold + (frames.size - 1) * transition
          encode(frames, out, width, height, fps, hold, transition)
          promise.resolve(mapOf("uri" to Uri.fromFile(out).toString(), "duration" to frameCount.toDouble() / fps))
        } catch (error: Throwable) {
          val detail = generateSequence(error) { it.cause }
            .mapNotNull { cause -> cause.message?.takeIf { it.isNotBlank() } }
            .distinct()
            .joinToString(" — ")
            .ifBlank { error.javaClass.simpleName }
          promise.reject("EXPORT_FAILED", detail, error)
        }
      }
    }
  }

  private fun encode(frames: List<MorphSource>, output: File, width: Int, height: Int, fps: Int, hold: Int, transition: Int) {
    val encoderInfo = MediaCodecList(MediaCodecList.REGULAR_CODECS).codecInfos.firstOrNull { info ->
      info.isEncoder &&
        info.supportedTypes.any { it.equals(MediaFormat.MIMETYPE_VIDEO_AVC, ignoreCase = true) } &&
        runCatching {
          info.getCapabilitiesForType(MediaFormat.MIMETYPE_VIDEO_AVC).colorFormats.contains(
            MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface,
          )
        }.getOrDefault(false)
    } ?: throw Exception("This phone has no compatible H.264 video encoder")
    val videoCapabilities = encoderInfo
      .getCapabilitiesForType(MediaFormat.MIMETYPE_VIDEO_AVC)
      .videoCapabilities
    val widthAlignment = maxOf(16, videoCapabilities.widthAlignment)
    val heightAlignment = maxOf(16, videoCapabilities.heightAlignment)
    val outputWidth = (width / widthAlignment * widthAlignment).coerceAtLeast(320)
    val outputHeight = (height / heightAlignment * heightAlignment).coerceAtLeast(320)
    if (!videoCapabilities.areSizeAndRateSupported(outputWidth, outputHeight, fps.toDouble())) {
      throw Exception("This phone cannot encode a ${outputWidth}×${outputHeight} H.264 video at ${fps}fps")
    }
    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, outputWidth, outputHeight).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, (outputWidth * outputHeight * 4).coerceIn(1_500_000, 8_000_000))
      setInteger(MediaFormat.KEY_FRAME_RATE, fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
    }
    val codec = try {
      MediaCodec.createByCodecName(encoderInfo.name)
    } catch (error: Throwable) {
      throw Exception("Could not open the phone's H.264 encoder: ${error.message ?: error.javaClass.simpleName}", error)
    }
    var egl: CodecSurface? = null
    var muxer: MediaMuxer? = null
    var codecStarted = false
    var track = -1
    var muxerStarted = false
    var muxerFinalized = false
    var samplesWritten = 0
    var pts = 0L
    fun drain(end: Boolean) {
      if (end) codec.signalEndOfInputStream()
      val info = MediaCodec.BufferInfo()
      var idleAttempts = 0
      while (true) {
        when (val index = codec.dequeueOutputBuffer(info, 10_000)) {
          MediaCodec.INFO_TRY_AGAIN_LATER -> {
            if (!end) return
            idleAttempts++
            if (idleAttempts >= 500) throw Exception("The H.264 encoder did not finish the video")
          }
          MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            if (muxerStarted) throw Exception("The encoder changed format more than once")
            track = requireNotNull(muxer).addTrack(codec.outputFormat)
            requireNotNull(muxer).start()
            muxerStarted = true
          }
          else -> if (index >= 0) {
            idleAttempts = 0
            if (info.size > 0 && (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
              if (!muxerStarted) throw Exception("The encoder produced video before its output format was ready")
              codec.getOutputBuffer(index)?.let { buffer ->
                buffer.position(info.offset)
                buffer.limit(info.offset + info.size)
                requireNotNull(muxer).writeSampleData(track, buffer, info)
                samplesWritten++
              }
            }
            codec.releaseOutputBuffer(index, false)
            if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) return
          }
        }
      }
    }
    try {
      try {
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      } catch (error: Throwable) {
        throw Exception("The phone rejected the H.264 video settings: ${error.message ?: error.javaClass.simpleName}", error)
      }
      val input = try {
        val input = codec.createInputSurface()
        input
      } catch (error: Throwable) {
        throw Exception("The phone could not create the video input surface: ${error.message ?: error.javaClass.simpleName}", error)
      }
      try {
        codec.start()
        codecStarted = true
      } catch (error: Throwable) {
        input.release()
        throw Exception("The phone could not start its H.264 encoder: ${error.message ?: error.javaClass.simpleName}", error)
      }
      try {
        egl = CodecSurface(input, outputWidth, outputHeight)
      } catch (error: Throwable) {
        input.release()
        throw Exception("The phone could not connect OpenGL to the video encoder: ${error.message ?: error.javaClass.simpleName}", error)
      }
      try {
        muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      } catch (error: Throwable) {
        throw Exception("The phone could not create the MP4 file: ${error.message ?: error.javaClass.simpleName}", error)
      }
      for (i in frames.indices) {
        val current = frames[i].load(appContext.reactContext!!, outputWidth, outputHeight)
        val next = try {
          frames.getOrNull(i + 1)?.load(appContext.reactContext!!, outputWidth, outputHeight)
        } catch (error: Throwable) {
          current.recycle()
          throw error
        }
        try {
          repeat(hold) { drain(false); submit(requireNotNull(egl), compose(current, null, 0f, outputWidth, outputHeight), pts); pts += 1_000_000_000L / fps; drain(false) }
          if (next != null) repeat(transition) { step -> val p = (step + 1).toFloat() / transition; drain(false); submit(requireNotNull(egl), compose(current, next, p, outputWidth, outputHeight), pts); pts += 1_000_000_000L / fps; drain(false) }
        } finally {
          current.recycle()
          next?.recycle()
        }
      }
      drain(true)
      if (!muxerStarted || samplesWritten == 0) throw Exception("The H.264 encoder produced no usable video")
      requireNotNull(muxer).stop()
      muxerFinalized = true
    } finally {
      try { egl?.release() } catch (_: Throwable) {}
      if (muxerStarted && !muxerFinalized) try { muxer?.stop() } catch (_: Throwable) {}
      try { muxer?.release() } catch (_: Throwable) {}
      if (codecStarted) try { codec.stop() } catch (_: Throwable) {}
      try { codec.release() } catch (_: Throwable) {}
      if (!muxerFinalized || !output.exists() || output.length() == 0L) output.delete()
    }
  }

  private fun submit(egl: CodecSurface, bitmap: Bitmap, timestamp: Long) {
    try {
      egl.draw(bitmap)
      egl.setPresentationTime(timestamp)
      egl.swap()
    } finally {
      bitmap.recycle()
    }
  }

  private fun compose(current: FrameRender, next: FrameRender?, progress: Float, width: Int, height: Int): Bitmap {
    val result = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(result)
    fun render(source: FrameRender): Bitmap {
      val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
      val target = Canvas(bitmap)
      target.drawBitmap(source.backdrop, 0f, 0f, Paint(Paint.ANTI_ALIAS_FLAG))
      val cover = maxOf(width.toFloat() / source.bitmap.width, height.toFloat() / source.bitmap.height)
      val scaledWidth = source.bitmap.width * cover * source.meta.scale
      val scaledHeight = source.bitmap.height * cover * source.meta.scale
      val matrix = GraphicsMatrix().apply {
        setScale(cover * source.meta.scale, cover * source.meta.scale)
        postTranslate((width - scaledWidth) / 2f + source.meta.x * width, (height - scaledHeight) / 2f + source.meta.y * height)
      }
      target.drawBitmap(source.bitmap, matrix, Paint(Paint.ANTI_ALIAS_FLAG))
      return bitmap
    }
    val currentImage = render(current)
    canvas.drawBitmap(currentImage, 0f, 0f, null)
    currentImage.recycle()
    if (next != null) {
      val nextImage = render(next)
      canvas.drawBitmap(nextImage, 0f, 0f, Paint(Paint.ANTI_ALIAS_FLAG).apply { alpha = (progress * 255).toInt() })
      nextImage.recycle()
    }
    return result
  }

}

private data class MorphSource(val uri: Uri, val x: Float, val y: Float, val scale: Float) {
  companion object {
    fun from(map: Map<*, *>): MorphSource {
      val uri = Uri.parse(map["uri"] as? String ?: throw Exception("Photo URI missing"))
      return MorphSource(uri, (map["x"] as? Number)?.toFloat() ?: 0f, (map["y"] as? Number)?.toFloat() ?: 0f, (map["scale"] as? Number)?.toFloat() ?: 1f)
    }
  }

  fun load(context: android.content.Context, width: Int, height: Int): FrameRender {
      val bytes = (context.contentResolver.openInputStream(uri) ?: throw Exception("Photo could not be read")).use { it.readBytes() }
      val orientation = ExifInterface(ByteArrayInputStream(bytes)).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
      val maxDimension = 1440
      var sample = 1
      while (maxOf(bounds.outWidth, bounds.outHeight) / sample > maxDimension) sample *= 2
      val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }) ?: throw Exception("Photo could not be decoded")
      val rotation = when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
      }
      val matrix = GraphicsMatrix().apply {
        when (orientation) {
          ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> postScale(-1f, 1f)
          ExifInterface.ORIENTATION_FLIP_VERTICAL -> postScale(1f, -1f)
          ExifInterface.ORIENTATION_TRANSPOSE -> { postScale(-1f, 1f); postRotate(90f) }
          ExifInterface.ORIENTATION_TRANSVERSE -> { postScale(-1f, 1f); postRotate(270f) }
          else -> Unit
        }
        if (rotation != 0f) postRotate(rotation)
      }
      val bitmap = if (orientation == ExifInterface.ORIENTATION_NORMAL) {
        decoded
      } else {
        Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true).also { transformed ->
          if (transformed !== decoded) decoded.recycle()
        }
      }
      val meta = MorphSource(uri, this.x, this.y, this.scale)
      return FrameRender(meta, bitmap, createBlurredBackdrop(bitmap, width, height))
  }
}

private class FrameRender(val meta: MorphSource, val bitmap: Bitmap, val backdrop: Bitmap) {
  fun recycle() {
    if (!bitmap.isRecycled) bitmap.recycle()
    if (!backdrop.isRecycled) backdrop.recycle()
  }
}

private fun createBlurredBackdrop(source: Bitmap, width: Int, height: Int): Bitmap {
  val smallWidth = 180
  val smallHeight = maxOf(1, (smallWidth * height.toFloat() / width).toInt())
  val small = Bitmap.createBitmap(smallWidth, smallHeight, Bitmap.Config.ARGB_8888)
  val smallCanvas = Canvas(small)
  val scaled = maxOf((smallWidth * 1.12f) / source.width, (smallHeight * 1.12f) / source.height)
  val scaledWidth = source.width * scaled
  val scaledHeight = source.height * scaled
  smallCanvas.drawBitmap(source, null, RectF((smallWidth - scaledWidth) / 2f, (smallHeight - scaledHeight) / 2f, (smallWidth + scaledWidth) / 2f, (smallHeight + scaledHeight) / 2f), Paint(Paint.ANTI_ALIAS_FLAG))
  val pixels = IntArray(smallWidth * smallHeight)
  small.getPixels(pixels, 0, smallWidth, 0, 0, smallWidth, smallHeight)
  small.recycle()
  val copy = pixels.copyOf()
  val radius = 6
  for (y in 0 until smallHeight) for (x in 0 until smallWidth) {
    var r = 0; var g = 0; var b = 0; var a = 0; var count = 0
    for (yy in maxOf(0, y - radius)..minOf(smallHeight - 1, y + radius))
      for (xx in maxOf(0, x - radius)..minOf(smallWidth - 1, x + radius)) {
        val c = copy[yy * smallWidth + xx]; a += Color.alpha(c); r += Color.red(c); g += Color.green(c); b += Color.blue(c); count++
      }
    pixels[y * smallWidth + x] = Color.argb(a / count, r / count, g / count, b / count)
  }
  val blurred = Bitmap.createBitmap(smallWidth, smallHeight, Bitmap.Config.ARGB_8888)
  blurred.setPixels(pixels, 0, smallWidth, 0, 0, smallWidth, smallHeight)
  return Bitmap.createScaledBitmap(blurred, width, height, true).also { blurred.recycle() }
}

/** Minimal EGL wrapper kept local to avoid an ffmpeg dependency. */
private class CodecSurface(private val surfaceRef: Surface, private val width: Int, private val height: Int) {
  private val display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
  private val eglContext: EGLContext
  private val eglSurface: EGLSurface
  private val texture: Int
  private val program: Int
  private val vertexBuffer = java.nio.ByteBuffer.allocateDirect(8 * Float.SIZE_BYTES).order(java.nio.ByteOrder.nativeOrder()).asFloatBuffer()
  init {
    if (display == EGL14.EGL_NO_DISPLAY) throw Exception("EGL display is unavailable")
    if (!EGL14.eglInitialize(display, intArrayOf(0, 0), 0, intArrayOf(0, 0), 0)) throw eglError("Could not initialise EGL")
    val config = arrayOfNulls<EGLConfig>(1)
    val count = intArrayOf(0)
    val choseConfig = EGL14.eglChooseConfig(display, intArrayOf(
      EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT, EGL14.EGL_SURFACE_TYPE, EGL14.EGL_WINDOW_BIT,
      EGL14.EGL_RED_SIZE, 8, EGL14.EGL_GREEN_SIZE, 8, EGL14.EGL_BLUE_SIZE, 8,
      0x3142, 1,
      EGL14.EGL_NONE
    ), 0, config, 0, 1, count, 0)
    if (!choseConfig || count[0] < 1 || config[0] == null) throw eglError("No recordable EGL configuration is available")
    eglContext = EGL14.eglCreateContext(display, config[0], EGL14.EGL_NO_CONTEXT, intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE), 0)
    if (eglContext == EGL14.EGL_NO_CONTEXT) throw eglError("Could not create the EGL context")
    eglSurface = EGL14.eglCreateWindowSurface(display, config[0], surfaceRef, intArrayOf(EGL14.EGL_NONE), 0)
    if (eglSurface == EGL14.EGL_NO_SURFACE) throw eglError("Could not create the encoder EGL surface")
    if (!EGL14.eglMakeCurrent(display, eglSurface, eglSurface, eglContext)) throw eglError("Could not activate the encoder EGL surface")
    GLES20.glViewport(0, 0, width, height)
    texture = createTexture()
    program = createProgram()
    vertexBuffer.put(floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f)).position(0)
  }
  fun draw(bitmap: Bitmap) {
    GLES20.glUseProgram(program)
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texture)
    GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
    GLES20.glUniform1i(GLES20.glGetUniformLocation(program, "uTexture"), 0)
    val position = GLES20.glGetAttribLocation(program, "aPosition")
    GLES20.glEnableVertexAttribArray(position)
    GLES20.glVertexAttribPointer(position, 2, GLES20.GL_FLOAT, false, 0, vertexBuffer)
    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
    val error = GLES20.glGetError()
    if (error != GLES20.GL_NO_ERROR) throw Exception("OpenGL could not draw video frame (0x${Integer.toHexString(error)})")
    GLES20.glDisableVertexAttribArray(position)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, 0)
  }
  fun setPresentationTime(time: Long) {
    if (!EGLExt.eglPresentationTimeANDROID(display, eglSurface, time)) throw eglError("Could not set the video frame timestamp")
  }
  fun swap() {
    if (!EGL14.eglSwapBuffers(display, eglSurface)) throw eglError("Could not submit a video frame")
  }
  fun release() {
    GLES20.glDeleteProgram(program); GLES20.glDeleteTextures(1, intArrayOf(texture), 0)
    EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
    EGL14.eglDestroySurface(display, eglSurface); EGL14.eglDestroyContext(display, eglContext); EGL14.eglTerminate(display)
    surfaceRef.release()
  }
  private fun createTexture(): Int {
    val ids = intArrayOf(0); GLES20.glGenTextures(1, ids, 0); GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, ids[0])
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
    return ids[0]
  }
  private fun createProgram(): Int {
    val vertex = compile(GLES20.GL_VERTEX_SHADER, "attribute vec2 aPosition; varying vec2 vUv; void main(){vUv=(aPosition+1.0)/2.0; gl_Position=vec4(aPosition,0.0,1.0);}")
    val fragment = compile(GLES20.GL_FRAGMENT_SHADER, "precision mediump float; varying vec2 vUv; uniform sampler2D uTexture; void main(){gl_FragColor=texture2D(uTexture,vec2(vUv.x,1.0-vUv.y));}")
    val result = GLES20.glCreateProgram(); GLES20.glAttachShader(result, vertex); GLES20.glAttachShader(result, fragment); GLES20.glLinkProgram(result)
    val status = intArrayOf(0)
    GLES20.glGetProgramiv(result, GLES20.GL_LINK_STATUS, status, 0)
    if (status[0] == 0) throw Exception("Could not link the video shader: ${GLES20.glGetProgramInfoLog(result)}")
    return result
  }
  private fun compile(type: Int, source: String): Int {
    val shader = GLES20.glCreateShader(type); GLES20.glShaderSource(shader, source); GLES20.glCompileShader(shader)
    val status = intArrayOf(0)
    GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, status, 0)
    if (status[0] == 0) throw Exception("Could not compile the video shader: ${GLES20.glGetShaderInfoLog(shader)}")
    return shader
  }
  private fun eglError(message: String) = Exception("$message (EGL 0x${Integer.toHexString(EGL14.eglGetError())})")
}
