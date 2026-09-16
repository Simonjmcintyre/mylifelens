package expo.modules.morphexport

import android.graphics.*
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
import java.io.FileOutputStream
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
          promise.reject("EXPORT_FAILED", error.message ?: "Video export failed.", error)
        }
      }
    }
  }

  private fun encode(frames: List<MorphSource>, output: File, width: Int, height: Int, fps: Int, hold: Int, transition: Int) {
    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, (width * height * 4).coerceIn(1_500_000, 8_000_000))
      setInteger(MediaFormat.KEY_FRAME_RATE, fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
    }
    val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    val input = codec.createInputSurface()
    codec.start()
    val egl = CodecSurface(input, width, height)
    val muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    var track = -1
    var started = false
    var pts = 0L
    fun drain(end: Boolean) {
      if (end) codec.signalEndOfInputStream()
      val info = MediaCodec.BufferInfo()
      while (true) {
        when (val index = codec.dequeueOutputBuffer(info, 10_000)) {
          MediaCodec.INFO_TRY_AGAIN_LATER -> if (!end) return
          MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> { track = muxer.addTrack(codec.outputFormat); muxer.start(); started = true }
          else -> if (index >= 0) {
            if (info.size > 0 && started) codec.getOutputBuffer(index)?.let { muxer.writeSampleData(track, it, info) }
            codec.releaseOutputBuffer(index, false)
            if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) return
          }
        }
      }
    }
    try {
      for (i in frames.indices) {
        val current = frames[i].load(appContext.reactContext!!, width, height)
        val next = try {
          frames.getOrNull(i + 1)?.load(appContext.reactContext!!, width, height)
        } catch (error: Throwable) {
          current.recycle()
          throw error
        }
        try {
          repeat(hold) { submit(egl, compose(current, null, 0f, width, height), pts); pts += 1_000_000_000L / fps; drain(false) }
          if (next != null) repeat(transition) { step -> val p = (step + 1).toFloat() / transition; submit(egl, compose(current, next, p, width, height), pts); pts += 1_000_000_000L / fps; drain(false) }
        } finally {
          current.recycle()
          next?.recycle()
        }
      }
      egl.release(); drain(true)
    } finally {
      if (started) muxer.stop()
      muxer.release(); codec.stop(); codec.release()
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
      val matrix = Matrix().apply {
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
      val matrix = Matrix().apply {
        when (orientation) {
          ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> postScale(-1f, 1f)
          ExifInterface.ORIENTATION_FLIP_VERTICAL -> postScale(1f, -1f)
          ExifInterface.ORIENTATION_TRANSPOSE -> { postScale(-1f, 1f); postRotate(90f) }
          ExifInterface.ORIENTATION_TRANSVERSE -> { postScale(-1f, 1f); postRotate(270f) }
          else -> Unit
        }
        if (rotation != 0f) postRotate(rotation)
      }
      val bitmap = if (orientation == ExifInterface.ORIENTATION_NORMAL) decoded else Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true).also { decoded.recycle() }
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
  private val vertexBuffer = java.nio.ByteBuffer.allocateDirect(16).order(java.nio.ByteOrder.nativeOrder()).asFloatBuffer()
  init {
    EGL14.eglInitialize(display, intArrayOf(0, 0), 0, intArrayOf(0, 0), 0)
    val config = arrayOfNulls<EGLConfig>(1)
    val count = intArrayOf(0)
    EGL14.eglChooseConfig(display, intArrayOf(
      EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT, EGL14.EGL_SURFACE_TYPE, EGL14.EGL_WINDOW_BIT,
      EGL14.EGL_RED_SIZE, 8, EGL14.EGL_GREEN_SIZE, 8, EGL14.EGL_BLUE_SIZE, 8, EGL14.EGL_ALPHA_SIZE, 8,
      0x3142, 1,
      EGL14.EGL_NONE
    ), 0, config, 0, 1, count, 0)
    eglContext = EGL14.eglCreateContext(display, config[0], EGL14.EGL_NO_CONTEXT, intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE), 0)
    eglSurface = EGL14.eglCreateWindowSurface(display, config[0], surfaceRef, intArrayOf(EGL14.EGL_NONE), 0)
    EGL14.eglMakeCurrent(display, eglSurface, eglSurface, eglContext)
    GLES20.glViewport(0, 0, width, height)
    texture = createTexture()
    program = createProgram()
    vertexBuffer.put(floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f)).position(0)
  }
  fun draw(bitmap: Bitmap) {
    GLES20.glUseProgram(program)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texture)
    GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
    val position = GLES20.glGetAttribLocation(program, "aPosition")
    GLES20.glEnableVertexAttribArray(position)
    GLES20.glVertexAttribPointer(position, 2, GLES20.GL_FLOAT, false, 0, vertexBuffer)
    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
    GLES20.glDisableVertexAttribArray(position)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, 0)
  }
  fun setPresentationTime(time: Long) { EGLExt.eglPresentationTimeANDROID(display, eglSurface, time) }
  fun swap() { EGL14.eglSwapBuffers(display, eglSurface) }
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
    return ids[0]
  }
  private fun createProgram(): Int {
    val vertex = compile(GLES20.GL_VERTEX_SHADER, "attribute vec2 aPosition; varying vec2 vUv; void main(){vUv=(aPosition+1.0)/2.0; gl_Position=vec4(aPosition,0.0,1.0);}")
    val fragment = compile(GLES20.GL_FRAGMENT_SHADER, "precision mediump float; varying vec2 vUv; uniform sampler2D uTexture; void main(){gl_FragColor=texture2D(uTexture,vec2(vUv.x,1.0-vUv.y));}")
    val result = GLES20.glCreateProgram(); GLES20.glAttachShader(result, vertex); GLES20.glAttachShader(result, fragment); GLES20.glLinkProgram(result); return result
  }
  private fun compile(type: Int, source: String): Int {
    val shader = GLES20.glCreateShader(type); GLES20.glShaderSource(shader, source); GLES20.glCompileShader(shader); return shader
  }
}