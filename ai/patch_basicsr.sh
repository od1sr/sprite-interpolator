#!/usr/bin/env bash
set -euo pipefail

# Patch BasicSR's setup.py before building/installing it by passing its source
# directory, and patch the installed torchvision import after installation.
python3 - "$@" <<'PY'
from pathlib import Path
import importlib.util
import re
import sys


def replace_once(path: Path, old: str, new: str, description: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        print(f"BasicSR patch already applied: {description}")
        return
    if old not in text:
        raise SystemExit(f"Cannot apply BasicSR patch ({description}): expected code not found in {path}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"Applied BasicSR patch: {description}")


if len(sys.argv) > 1:
    source = Path(sys.argv[1]).resolve()
    setup_py = source / "setup.py"
    if not setup_py.is_file():
        raise SystemExit(f"BasicSR source setup.py not found: {setup_py}")
    replace_once(
        setup_py,
        "exec(compile(f.read(), version_file, 'exec'))",
        "version_ns = {}\n        exec(compile(f.read(), version_file, 'exec'), version_ns)",
        "Python 3.13 setup.py version lookup",
    )
    replace_once(
        setup_py,
        "return locals()['__version__']",
        "return version_ns['__version__']",
        "Python 3.13 setup.py version lookup",
    )

spec = importlib.util.find_spec("basicsr")
if spec is None or spec.origin is None:
    if len(sys.argv) > 1:
        print("BasicSR is not installed yet; source patch is complete")
        raise SystemExit(0)
    raise SystemExit("BasicSR is not installed; pass its source directory to patch setup.py")

degradations = Path(spec.origin).parent / "data" / "degradations.py"
if not degradations.is_file():
    raise SystemExit(f"BasicSR degradations.py not found: {degradations}")
replace_once(
    degradations,
    "from torchvision.transforms.functional_tensor import rgb_to_grayscale",
    "from torchvision.transforms.functional import rgb_to_grayscale",
    "torchvision 0.17+ grayscale import",
)
PY
