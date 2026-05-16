"""Generate N0Tune icon PNGs from a source image.

Inputs:
- img/logo-s2.png by default (512×661, denser source).

Outputs:
- apps/desktop/src-tauri/icons/{32,64,128,256,512}.png   (Tauri PNG sizes)
- apps/desktop/src-tauri/icons/128x128@2x.png            (Tauri's required Retina @2x)
- apps/desktop/src-tauri/icons/icon.png                  (1024×1024 master for `tauri icon`)
- apps/desktop/public/favicon.png                        (32×32 favicon)
- apps/dashboard/public/favicon.png                      (32×32 favicon)

`tauri icon` reads `icon.png` to generate .icns / .ico / Microsoft Store
sizes on demand; we never commit those.

Usage:
    python scripts/gen-icons.py                  # uses img/logo-s2.png
    python scripts/gen-icons.py --source img/logo.png

Requires Pillow (already a dev dep via the API package).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
DESKTOP_ICONS = REPO_ROOT / "apps" / "desktop" / "src-tauri" / "icons"
DESKTOP_PUBLIC = REPO_ROOT / "apps" / "desktop" / "public"
DASHBOARD_PUBLIC = REPO_ROOT / "apps" / "dashboard" / "public"

PNG_SIZES = [32, 64, 128, 256, 512]


def pad_square(image: Image.Image) -> Image.Image:
    side = max(image.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    offset_x = (side - image.width) // 2
    offset_y = (side - image.height) // 2
    canvas.paste(image, (offset_x, offset_y))
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default=str(REPO_ROOT / "img" / "logo-s2.png"),
        help="Path to the source PNG. Defaults to img/logo-s2.png.",
    )
    args = parser.parse_args()

    source_path = Path(args.source)
    if not source_path.is_file():
        print(f"error: source {source_path} not found", file=sys.stderr)
        return 1

    DESKTOP_ICONS.mkdir(parents=True, exist_ok=True)
    DESKTOP_PUBLIC.mkdir(parents=True, exist_ok=True)
    DASHBOARD_PUBLIC.mkdir(parents=True, exist_ok=True)

    original = Image.open(source_path).convert("RGBA")
    square = pad_square(original)
    print(f"source: {source_path} ({original.size[0]}x{original.size[1]})")
    print(f"squared: {square.size[0]}x{square.size[1]}")

    for size in PNG_SIZES:
        target = DESKTOP_ICONS / f"{size}x{size}.png"
        square.resize((size, size), Image.LANCZOS).save(target)
        print(f"  wrote {target.relative_to(REPO_ROOT)}")

    # Tauri's required Retina @2x for 128x128 = 256x256 image.
    retina_target = DESKTOP_ICONS / "128x128@2x.png"
    square.resize((256, 256), Image.LANCZOS).save(retina_target)
    print(f"  wrote {retina_target.relative_to(REPO_ROOT)}")

    # Master 1024×1024 source so `tauri icon` can regenerate platform-specific
    # formats cleanly without quality loss.
    master_target = DESKTOP_ICONS / "icon.png"
    square.resize((1024, 1024), Image.LANCZOS).save(master_target)
    print(f"  wrote {master_target.relative_to(REPO_ROOT)}")

    # Favicons for both web apps (32×32).
    favicon = square.resize((32, 32), Image.LANCZOS)
    for target in (DESKTOP_PUBLIC / "favicon.png", DASHBOARD_PUBLIC / "favicon.png"):
        favicon.save(target)
        print(f"  wrote {target.relative_to(REPO_ROOT)}")

    print("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
