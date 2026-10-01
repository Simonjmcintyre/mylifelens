package expo.modules.projectalbums

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class AlbumFolderNameTest {
  @Test
  fun unsafeNamesThatSanitizeToTheSameTextRemainDistinct() {
    val slashName = AlbumFolderName.normalize("Before/After")
    val colonName = AlbumFolderName.normalize("Before:After")

    assertNotEquals(slashName, colonName)
  }

  @Test
  fun normalizationIsStableForRepeatedNames() {
    val name = "Before/After"

    assertEquals(AlbumFolderName.normalize(name), AlbumFolderName.normalize(name))
  }

  @Test
  fun longNamesRetainIdentityFromTheirOriginalText() {
    val prefix = "p".repeat(80)
    val commonTail = "x".repeat(21) + "(2)"

    assertNotEquals(
      AlbumFolderName.normalize(prefix + "alpha".repeat(8) + commonTail),
      AlbumFolderName.normalize(prefix + "bravo".repeat(8) + commonTail),
    )
  }

  @Test
  fun ordinaryNamesRemainUnchanged() {
    val name = "MyLifelens Before and After"

    assertEquals(name, AlbumFolderName.normalize(name))
  }

  @Test
  fun longNamesStayWithinLimitAndRetainTheirDuplicateSuffix() {
    val name = "MyLifelens " + "project ".repeat(20) + "(2)"
    val folderName = AlbumFolderName.normalize(name)

    assertTrue(folderName.length <= 100)
    assertTrue(folderName.endsWith("(2)"))
  }

  @Test
  fun dotOnlyAndEmptyNamesAreRejected() {
    assertThrows(IllegalArgumentException::class.java) {
      AlbumFolderName.normalize("")
    }
    assertThrows(IllegalArgumentException::class.java) {
      AlbumFolderName.normalize("...")
    }
  }
}