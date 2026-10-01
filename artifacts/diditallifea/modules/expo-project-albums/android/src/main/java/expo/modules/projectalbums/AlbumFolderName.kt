package expo.modules.projectalbums

import java.security.MessageDigest

object AlbumFolderName {
  private const val MAX_LENGTH = 100
  private const val PRESERVED_TAIL_LENGTH = 24

  fun normalize(albumName: String): String {
    val sanitizedName = albumName
      .replace(Regex("[/\\\\:*?\"<>|\\p{Cc}]"), "_")
      .trim()
      .trim('.')

    if (sanitizedName.isEmpty() || sanitizedName == "." || sanitizedName == "..") {
      throw IllegalArgumentException("The album name does not contain a usable folder name.")
    }

    val needsHash = sanitizedName != albumName || sanitizedName.length > MAX_LENGTH
    if (!needsHash) {
      return sanitizedName
    }

    val hash = MessageDigest.getInstance("SHA-256")
      .digest(albumName.toByteArray(Charsets.UTF_8))
      .take(8)
      .joinToString("") { byte -> (byte.toInt() and 0xff).toString(16).padStart(2, '0') }
    val hashSuffix = "_$hash"
    if (sanitizedName.length + hashSuffix.length <= MAX_LENGTH) {
      return sanitizedName + hashSuffix
    }

    val tailLength = minOf(PRESERVED_TAIL_LENGTH, sanitizedName.length)
    val prefixLength = MAX_LENGTH - hashSuffix.length - tailLength
    return sanitizedName.take(prefixLength) + hashSuffix + sanitizedName.takeLast(tailLength)
  }
}