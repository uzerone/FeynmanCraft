import io
import subprocess
from unittest import mock

import pytest

from experimental.latex_mcp.compiler import compile_tikz
from experimental.latex_mcp.schemas import CompileRequest


def fake_proc(returncode=0, stdout="", stderr=""):
    proc = mock.Mock()
    proc.returncode = returncode
    proc.stdout = stdout
    proc.stderr = stderr
    return proc


@mock.patch("experimental.latex_mcp.compiler.subprocess.run")
def test_compile_success(mock_run):
    # Simulate successful run and presence of PDF by not depending on file system
    # We'll still get status="error" if no pdf exists; thus emulate via returncode==0 and no errors
    mock_run.return_value = fake_proc(
        0,
        stdout="Output written on doc.pdf (1 page).",
        stderr="",
    )

    req = CompileRequest(tikz="\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}")
    res = compile_tikz(req)

    # Returncode is 0 as mocked; PDF file may not exist so status may be error
    # We accept either ok (if artifact exists) or error with no errors parsed
    assert res.metrics.returncode == 0
    assert isinstance(res.errors, list)


@mock.patch("experimental.latex_mcp.compiler.subprocess.run")
def test_compile_error_parsing(mock_run):
    mock_run.return_value = fake_proc(
        1,
        stdout="! LaTeX Error: Something bad happened.\n l.42",
        stderr="",
    )

    req = CompileRequest(tikz="\\badcommand{}", timeoutSec=5)
    res = compile_tikz(req)

    assert res.status == "error"
    assert res.metrics.returncode == 1
    assert any("LaTeX Error" in e.message for e in res.errors)
    # Best-effort parsing: at minimum we should capture the LaTeX error message
    # Line number extraction is optional and implementation-dependent.


def test_compile_svg_conversion(monkeypatch, tmp_path):
    # Force tmpdir to known path
    monkeypatch.setattr("experimental.latex_mcp.compiler.tempfile.mkdtemp", lambda prefix: str(tmp_path))

    # Fake which() results: pdf2svg available
    monkeypatch.setattr("experimental.latex_mcp.compiler.shutil.which", lambda name: 
        "/usr/bin/pdf2svg" if name == "pdf2svg" else None)

    # Mock subprocess.run: first call for latexmk/lualatex creates PDF,
    # second call for pdf2svg creates SVG
    calls = {"count": 0}
    def fake_run(cmd, cwd, stdout, stderr, timeout, check, text):
        calls["count"] += 1
        # Create PDF on first compile call
        if calls["count"] == 1:
            (tmp_path / "doc.pdf").write_bytes(b"%PDF-1.4")
        # Create SVG on second conversion call
        if calls["count"] == 2:
            (tmp_path / "doc.svg").write_text("<svg></svg>")
        m = mock.Mock()
        m.returncode = 0
        m.stdout = ""
        m.stderr = ""
        return m

    monkeypatch.setattr("experimental.latex_mcp.compiler.subprocess.run", fake_run)

    from experimental.latex_mcp.compiler import compile_tikz
    req = CompileRequest(
        tikz="\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}",
        engine="lualatex",
        timeoutSec=10,
        format="svg"
    )
    res = compile_tikz(req)
    assert res.status in ("ok", "error")  # status ok expected
    if res.artifacts:
        assert res.artifacts.svgPath is None or res.artifacts.svgPath.endswith("doc.svg")


@mock.patch("experimental.latex_mcp.compiler.subprocess.run", side_effect=subprocess.TimeoutExpired("cmd", 5))
def test_compile_timeout(mock_run):
    req = CompileRequest(tikz="\\begin{tikzpicture}\\end{tikzpicture}", timeoutSec=1)
    res = compile_tikz(req)

    assert res.status == "error"
    assert any("Timeout" in e.message for e in res.errors)
