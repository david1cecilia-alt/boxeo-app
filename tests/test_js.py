"""Tests unitarios de JavaScript (node:test en tests/js/*.test.mjs), lanzados desde pytest.

Así un solo comando (pytest) cubre Python y JS, también en CI.
"""
import os
import shutil
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
NODE = shutil.which("node")
FICHEROS = sorted((RAIZ / "tests" / "js").glob("*.test.mjs"))


@pytest.mark.skipif(NODE is None and not os.environ.get("CI"), reason="node no está instalado")
@pytest.mark.parametrize("fichero", FICHEROS, ids=lambda f: f.name)
def test_js(fichero):
    assert NODE, "Los tests de JS necesitan node en el PATH"
    r = subprocess.run([NODE, "--test", "--test-reporter=spec", str(fichero)],
                       cwd=RAIZ, capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 0, r.stdout + r.stderr
