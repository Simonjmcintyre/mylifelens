"""Fixture tests for the Android release media-permission guard."""

import contextlib
import importlib.util
import io
import tempfile
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "check_android_media_permissions",
    SCRIPT_DIR / "check-android-media-permissions.py",
)
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)


ANDROID_NS = "http://schemas.android.com/apk/res/android"


def write_manifest(path: Path, permissions: list[str]) -> Path:
    permission_nodes = "".join(
        f'<uses-permission android:name="{permission}" />'
        for permission in permissions
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        f'<manifest xmlns:android="{ANDROID_NS}">{permission_nodes}</manifest>',
        encoding="utf-8",
    )
    return path


class AndroidMediaPermissionGuardTests(unittest.TestCase):
    def test_success_prints_actual_permissions(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            write_manifest(
                root / "merged_manifests/release/processReleaseManifest/AndroidManifest.xml",
                ["android.permission.CAMERA"],
            )
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                result = guard.main([str(root)])

            self.assertEqual(result, 0)
            self.assertIn("android.permission.CAMERA", output.getvalue())

    def test_forbidden_permission_in_either_permission_element_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            path = root / "merged_manifests/release/AndroidManifest.xml"
            path.parent.mkdir(parents=True)
            permissions = (
                '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />'
                '<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />'
                '<uses-permission-sdk-23 android:name="android.permission.READ_EXTERNAL_STORAGE" />'
                '<uses-permission-sdk-23 android:name="android.permission.READ_MEDIA_VISUAL_USER_SELECTED" />'
            )
            path.write_text(
                f'<manifest xmlns:android="{ANDROID_NS}">{permissions}</manifest>',
                encoding="utf-8",
            )
            errors = io.StringIO()
            with contextlib.redirect_stderr(errors):
                result = guard.main([str(root)])

            self.assertEqual(result, 1)
            for permission in guard.FORBIDDEN_PERMISSIONS:
                self.assertIn(permission, errors.getvalue())

    def test_missing_release_manifest_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            write_manifest(
                root / "packaged_manifests/release/AndroidManifest.xml",
                ["android.permission.READ_MEDIA_IMAGES"],
            )
            write_manifest(
                root / "merged_manifests/debug/AndroidManifest.xml",
                ["android.permission.READ_MEDIA_IMAGES"],
            )
            errors = io.StringIO()
            with contextlib.redirect_stderr(errors):
                result = guard.main([str(root)])

            self.assertEqual(result, 1)
            self.assertIn("No final merged release", errors.getvalue())

    def test_malformed_release_manifest_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            malformed = root / "merged_manifests/release/AndroidManifest.xml"
            malformed.parent.mkdir(parents=True)
            malformed.write_text("<manifest>", encoding="utf-8")
            errors = io.StringIO()
            with contextlib.redirect_stderr(errors):
                result = guard.main([str(root)])

            self.assertEqual(result, 1)
            self.assertIn("Could not parse", errors.getvalue())

    def test_release_selection_ignores_other_outputs_and_prefers_plural(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            plural_manifest = write_manifest(
                root / "merged_manifests/release/processReleaseManifest/AndroidManifest.xml",
                ["android.permission.CAMERA"],
            )
            write_manifest(
                root / "merged_manifest/release/AndroidManifest.xml",
                ["android.permission.READ_EXTERNAL_STORAGE"],
            )
            write_manifest(
                root / "packaged_manifests/release/AndroidManifest.xml",
                ["android.permission.READ_MEDIA_VIDEO"],
            )
            write_manifest(
                root / "merged_manifests/debug/AndroidManifest.xml",
                ["android.permission.READ_MEDIA_IMAGES"],
            )

            self.assertEqual(guard.find_release_manifests(root), [plural_manifest])
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                result = guard.main([str(root)])
            self.assertEqual(result, 0)
            self.assertIn("android.permission.CAMERA", output.getvalue())


if __name__ == "__main__":
    unittest.main()