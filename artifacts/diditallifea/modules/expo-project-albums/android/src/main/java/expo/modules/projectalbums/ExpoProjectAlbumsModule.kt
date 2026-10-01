package expo.modules.projectalbums

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.util.Locale
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

class ExpoProjectAlbumsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoProjectAlbums")

    AsyncFunction("savePhotoToAlbum") Coroutine { options: Map<String, Any?> ->
      val sourceUri = options["uri"] as? String
        ?: throw IllegalArgumentException("A source photo URI is required.")
      val albumName = options["albumName"] as? String
        ?: throw IllegalArgumentException("An album name is required.")
      val context = appContext.reactContext
        ?: throw IllegalStateException("The Android application context is unavailable.")

      val savedUri = withContext(Dispatchers.IO) {
        val source = validateSource(context, sourceUri)
        val albumFolder = AlbumFolderName.normalize(albumName)
        val (extension, mimeType) = imageType(source)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          saveWithMediaStore(context, source, albumFolder, extension, mimeType)
        } else {
          saveWithLegacyStorage(context, source, albumFolder, extension, mimeType)
        }
      }
      return@Coroutine mapOf("uri" to savedUri.toString())
    }
  }

  private fun validateSource(context: Context, sourceUri: String): File {
    val uri = Uri.parse(sourceUri)
    if (uri.scheme != "file" || !uri.authority.isNullOrEmpty()) {
      throw IllegalArgumentException("The source photo must be a private app file:// URI.")
    }

    val path = uri.path
      ?: throw IllegalArgumentException("The source photo URI does not contain a file path.")
    val source = File(path).canonicalFile
    val appRoots = listOf(context.filesDir, context.cacheDir).map { it.canonicalFile }
    val isPrivateAppFile = appRoots.any { root ->
      source.path.startsWith(root.path + File.separator)
    }

    if (!isPrivateAppFile || !source.isFile || !source.canRead() || source.length() <= 0L) {
      throw IllegalArgumentException(
        "The source photo must be a readable, non-empty file inside the app's files or cache directory.",
      )
    }
    return source
  }

  private fun imageType(source: File): Pair<String, String> {
    val extension = source.extension.lowercase(Locale.ROOT)
    val mimeType = when (extension) {
      "jpg", "jpeg" -> "image/jpeg"
      "png" -> "image/png"
      "heic" -> "image/heic"
      "webp" -> "image/webp"
      else -> throw IllegalArgumentException(
        "Unsupported photo extension. Use jpg, jpeg, png, heic, or webp.",
      )
    }
    return extension to mimeType
  }

  private fun uniqueDisplayName(extension: String): String =
    "MyLifelens_${UUID.randomUUID()}.$extension"

  private fun saveWithMediaStore(
    context: Context,
    source: File,
    albumFolder: String,
    extension: String,
    mimeType: String,
  ): Uri {
    val resolver = context.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.Images.Media.DISPLAY_NAME, uniqueDisplayName(extension))
      put(MediaStore.Images.Media.MIME_TYPE, mimeType)
      put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$albumFolder/")
      put(MediaStore.Images.Media.IS_PENDING, 1)
    }
    val destination = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
      ?: throw IOException("Android could not create the photo in the requested album.")

    try {
      val output = resolver.openOutputStream(destination, "w")
        ?: throw IOException("Android could not open the new photo for writing.")
      output.use { stream ->
        FileInputStream(source).use { input -> input.copyTo(stream) }
      }

      val publishValues = ContentValues().apply {
        put(MediaStore.Images.Media.IS_PENDING, 0)
      }
      if (resolver.update(destination, publishValues, null, null) != 1) {
        throw IOException("Android could not publish the saved photo.")
      }
      return destination
    } catch (error: Throwable) {
      runCatching { resolver.delete(destination, null, null) }
      throw error
    }
  }

  private suspend fun saveWithLegacyStorage(
    context: Context,
    source: File,
    albumFolder: String,
    extension: String,
    mimeType: String,
  ): Uri {
    if (context.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      throw SecurityException("WRITE_EXTERNAL_STORAGE permission is required to save this photo.")
    }

    val picturesDirectory =
      Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
    val destinationDirectory = File(picturesDirectory, albumFolder)
    val canonicalPicturesDirectory = picturesDirectory.canonicalFile
    val canonicalDestinationDirectory = destinationDirectory.canonicalFile
    val destinationIsInsidePictures =
      canonicalDestinationDirectory.path.startsWith(canonicalPicturesDirectory.path + File.separator)
    if (!destinationIsInsidePictures) {
      throw IllegalArgumentException("The album name resolves outside the Pictures directory.")
    }
    if (!destinationDirectory.mkdirs() && !destinationDirectory.isDirectory) {
      throw IOException("Android could not create the requested photo album.")
    }

    val destination = File(destinationDirectory, uniqueDisplayName(extension))
    if (!destination.createNewFile()) {
      throw IOException("Android could not create a unique photo file.")
    }

    try {
      FileInputStream(source).use { input ->
        destination.outputStream().use { input.copyTo(it) }
      }
      return awaitMediaScan(context, destination, mimeType)
    } catch (error: Throwable) {
      destination.delete()
      throw error
    }
  }

  private suspend fun awaitMediaScan(context: Context, file: File, mimeType: String): Uri =
    withTimeout(MEDIA_SCAN_TIMEOUT_MS) {
      suspendCancellableCoroutine { continuation ->
        continuation.invokeOnCancellation { file.delete() }
        MediaScannerConnection.scanFile(
          context,
          arrayOf(file.absolutePath),
          arrayOf(mimeType),
        ) { _, scannedUri ->
          if (scannedUri == null) {
            file.delete()
            if (continuation.isActive) {
              continuation.resumeWithException(IOException("Android could not index the saved photo."))
            }
          } else if (continuation.isActive) {
            continuation.resume(scannedUri)
          }
        }
      }
    }

  private companion object {
    const val MEDIA_SCAN_TIMEOUT_MS = 30_000L
  }
}