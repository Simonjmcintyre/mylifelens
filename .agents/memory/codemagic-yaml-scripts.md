---
name: Codemagic YAML scripts
description: A YAML indentation constraint affecting embedded Python or shell scripts in Codemagic workflows.
---

When embedding Python or shell logic in a Codemagic YAML block scalar, avoid matching multiline file content with visually indented triple-quoted literals. YAML removes the block’s common indentation, which can change the literal’s leading whitespace and make exact matches fail.

**Why:** A release-signing configuration script failed even though the generated Gradle file had the expected content; the failure came from whitespace altered by YAML indentation.

**How to apply:** Prefer escaped `\n` strings, regular expressions, or line-based edits when a workflow script must modify generated files.