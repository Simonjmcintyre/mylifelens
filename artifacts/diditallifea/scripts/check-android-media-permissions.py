#!/usr/bin/env python3
"""Reject broad media permissions in Android's final merged release manifest."""

from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Sequence


ANDROID_NAMESPACE = "http://schemas.android.com/apk/res/android"
PERMISSION_NAME_ATTRIBUTE = f"{{{ANDROID_NAMESPACE}}}name"
PERMISSION_ELEMENTS = {"uses-permission", "uses-permission-sdk-23"}
FORBIDDEN_PERMISSIONS = {
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
}


def find_release_manifests(intermediates: Path) -> list[Path]:
    """Find final release manifests, preferring AGP's plural output directory."""
    for output_name in ("merged_manifests", "merged_manifest"):
        release_dir = intermediates / output_name / "release"
        if not release_dir.is_dir():
            continue

        manifests = []
        for manifest in sorted(release_dir.rglob("AndroidManifest.xml")):
            relative_parts = manifest.relative_to(release_dir).parts[:-1]
            if any(
                "library" in part.lower()
                or part.lower() in {"debug", "packaged", "packaged_manifests"}
                for part in relative_parts
            ):
                continue
            manifests.append(manifest)
        if manifests:
            return manifests
    return []


def read_manifest_permissions(manifest: Path) -> list[str]:
    root = ET.parse(manifest).getroot()
    return sorted(
        {
            permission
            for element in root.iter()
            if element.tag.rsplit("}", 1)[-1] in PERMISSION_ELEMENTS
            and (permission := element.get(PERMISSION_NAME_ATTRIBUTE))
        }
    )


def main(argv: Sequence[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) != 1:
        print(
            "Usage: check-android-media-permissions.py "
            "<intermediates-directory|manifest.xml>",
            file=sys.stderr,
        )
        return 2

    input_path = Path(args[0])
    if input_path.is_file():
        manifests = [input_path]
    elif input_path.is_dir():
        manifests = find_release_manifests(input_path)
    else:
        print(f"Input path does not exist: {input_path}", file=sys.stderr)
        return 2

    if not manifests:
        print(
            f"No final merged release AndroidManifest.xml found under {input_path}",
            file=sys.stderr,
        )
        return 1

    permissions_by_manifest: list[tuple[Path, list[str]]] = []
    try:
        for manifest in manifests:
            permissions_by_manifest.append(
                (manifest, read_manifest_permissions(manifest))
            )
    except (ET.ParseError, OSError) as error:
        print(f"Could not parse merged release manifest {manifest}: {error}", file=sys.stderr)
        return 1

    violations = [
        (manifest, permission)
        for manifest, permissions in permissions_by_manifest
        for permission in permissions
        if permission in FORBIDDEN_PERMISSIONS
    ]
    if violations:
        for manifest, permission in violations:
            print(
                f"Forbidden media permission {permission} found in {manifest}",
                file=sys.stderr,
            )
        return 1

    actual_permissions = sorted(
        {
            permission
            for _, permissions in permissions_by_manifest
            for permission in permissions
        }
    )
    print("Android media permission guard passed.")
    print("Permissions in final merged release manifest(s):")
    if actual_permissions:
        for permission in actual_permissions:
            print(f"  {permission}")
    else:
        print("  (none)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())