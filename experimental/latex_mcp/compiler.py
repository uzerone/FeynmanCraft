import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import List, Tuple, Optional

from schemas import (
    CompileRequest,
    CompileResult,
    CompileMetrics,
    CompileArtifacts,
    CompilerMessage,
)


def _build_document_body(tikz_body: str) -> str:
    # Wrap plain TikZ code into a minimal standalone document if needed
    preamble = (
        "\\documentclass{standalone}\n"
        "\\usepackage{tikz}\n"
        "\\usepackage{tikz-feynman}\n"
        "\\begin{document}\n"
    )
    trailer = "\n\\end{document}\n"

    # Heuristics: if it already contains \documentclass, treat as full doc
    if "\\documentclass" in tikz_body:
        return tikz_body
    return preamble + tikz_body + trailer


def _parse_latex_output(stdout: str, stderr: str) -> Tuple[List[CompilerMessage], List[CompilerMessage]]:
    errors: List[CompilerMessage] = []
    warnings: List[CompilerMessage] = []

    lines = (stdout + "\n" + stderr).splitlines()
    for idx, line in enumerate(lines):
        s = line.strip()
        if s.startswith("! "):
            ln_val = None
            if idx + 1 < len(lines):
                nxt = lines[idx + 1]
                m = re.search(r"l\\.(\d+)", nxt) or re.search(r"line\s+(\d+)", nxt, re.IGNORECASE)
                if m:
                    ln_val = int(m.group(1))
            errors.append(
                CompilerMessage(
                    message=s,
                    line=ln_val,
                    source="latex" if ln_val is not None else None,
                )
            )
        elif re.search(r"Package .* Warning: ", line):
            warnings.append(CompilerMessage(message=s))
        # else: ignore miscellaneous lines

    return errors, warnings


def compile_tikz(req: CompileRequest) -> CompileResult:
    start = time.time()
    tmpdir = Path(tempfile.mkdtemp(prefix="latex_mcp_"))
    tex_path = tmpdir / "doc.tex"
    pdf_path = tmpdir / "doc.pdf"

    try:
        body = _build_document_body(req.tikz)
        tex_path.write_text(body, encoding="utf-8")

        # Choose engine
        engine = "lualatex" if req.engine == "lualatex" else "pdflatex"

        # Use latexmk for stable builds if available, else direct engine
        latexmk = shutil.which("latexmk")
        if latexmk:
            cmd = [
                latexmk,
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-f",
                f"-{engine}",
                "-file-line-error",
                str(tex_path),
            ]
        else:
            engine_bin = shutil.which(engine) or engine
            cmd = [
                engine_bin,
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-file-line-error",
                str(tex_path),
            ]

        proc = subprocess.run(
            cmd,
            cwd=str(tmpdir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=req.timeoutSec,
            check=False,
            text=True,
        )

        errors, warnings = _parse_latex_output(proc.stdout or "", proc.stderr or "")
        status = "ok" if proc.returncode == 0 and pdf_path.exists() else "error"

        svg_path: Optional[Path] = None
        png_path: Optional[Path] = None
        
        # If SVG requested and PDF is available, attempt conversion (best-effort)
        if status == "ok" and req.format in ("svg", "both", "all") and pdf_path.exists():
            svg_path, conv_err, conv_warn = _convert_pdf_to_svg(tmpdir, pdf_path, req.timeoutSec)
            if conv_err:
                errors.extend(conv_err)
            if conv_warn:
                warnings.extend(conv_warn)
        
        # If PNG requested and PDF is available, attempt conversion (best-effort)
        if status == "ok" and req.format in ("png", "both", "all") and pdf_path.exists():
            png_path, conv_err, conv_warn = _convert_pdf_to_png(tmpdir, pdf_path, req.timeoutSec)
            if conv_err:
                errors.extend(conv_err)
            if conv_warn:
                warnings.extend(conv_warn)

        artifacts = None
        if pdf_path.exists() or (svg_path and svg_path.exists()) or (png_path and png_path.exists()):
            artifacts = CompileArtifacts(
                pdfPath=str(pdf_path) if pdf_path.exists() else None,
                svgPath=str(svg_path) if (svg_path and svg_path.exists()) else None,
                pngPath=str(png_path) if (png_path and png_path.exists()) else None,
            )
        metrics = CompileMetrics(
            latency_ms=int((time.time() - start) * 1000), returncode=proc.returncode
        )

        return CompileResult(
            status=status, errors=errors, warnings=warnings, metrics=metrics, artifacts=artifacts
        )

    except subprocess.TimeoutExpired as e:
        metrics = CompileMetrics(latency_ms=int((time.time() - start) * 1000), returncode=124)
        return CompileResult(
            status="error",
            errors=[CompilerMessage(message=f"Timeout after {req.timeoutSec}s")],
            warnings=[],
            metrics=metrics,
            artifacts=None,
        )
    finally:
        # Keep tmpdir to allow artifacts inspection by caller; cleanup should be external.
        pass


def _convert_pdf_to_svg(tmpdir: Path, pdf_path: Path, timeout: int) -> Tuple[Optional[Path], List[CompilerMessage], List[CompilerMessage]]:
    """Convert a PDF to SVG using available converters (pdf2svg > inkscape > dvisvgm)."""
    errors: List[CompilerMessage] = []
    warnings: List[CompilerMessage] = []
    svg_out = tmpdir / "doc.svg"

    def run_cmd(cmd: List[str]) -> subprocess.CompletedProcess:
        return subprocess.run(
            cmd, cwd=str(tmpdir), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, check=False, text=True
        )

    # Try pdf2svg
    pdf2svg = shutil.which("pdf2svg")
    if pdf2svg:
        proc = run_cmd([pdf2svg, str(pdf_path), str(svg_out)])
        if proc.returncode == 0 and svg_out.exists():
            return svg_out, errors, warnings
        warnings.append(CompilerMessage(message=f"pdf2svg failed rc={proc.returncode}"))

    # Try inkscape
    inkscape = shutil.which("inkscape")
    if inkscape:
        # Newer Inkscape CLI
        proc = run_cmd([inkscape, str(pdf_path), "--export-type=svg", f"--export-filename={svg_out}"])
        if proc.returncode == 0 and svg_out.exists():
            return svg_out, errors, warnings
        # Older CLI fallback
        proc = run_cmd([inkscape, str(pdf_path), "--export-plain-svg", str(svg_out)])
        if proc.returncode == 0 and svg_out.exists():
            return svg_out, errors, warnings
        warnings.append(CompilerMessage(message=f"inkscape failed to export SVG"))

    # Try dvisvgm with PDF input
    dvisvgm = shutil.which("dvisvgm")
    if dvisvgm:
        proc = run_cmd([dvisvgm, "--pdf", str(pdf_path), "-n", "-o", str(svg_out)])
        if proc.returncode == 0 and svg_out.exists():
            return svg_out, errors, warnings
        warnings.append(CompilerMessage(message=f"dvisvgm failed to convert PDF"))

    errors.append(CompilerMessage(message="No SVG converter available (install pdf2svg or inkscape)", suggest="sudo apt install pdf2svg inkscape"))
    return None, errors, warnings


def _convert_pdf_to_png(tmpdir: Path, pdf_path: Path, timeout: int) -> Tuple[Optional[Path], List[CompilerMessage], List[CompilerMessage]]:
    """Convert a PDF to PNG using available converters (pdftoppm > convert > gs)."""
    errors: List[CompilerMessage] = []
    warnings: List[CompilerMessage] = []
    png_out = tmpdir / "doc.png"

    def run_cmd(cmd: List[str]) -> subprocess.CompletedProcess:
        return subprocess.run(
            cmd, cwd=str(tmpdir), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, check=False, text=True
        )

    # Try pdftoppm (from poppler-utils)
    pdftoppm = shutil.which("pdftoppm")
    if pdftoppm:
        proc = run_cmd([pdftoppm, "-png", "-singlefile", "-r", "300", str(pdf_path), "doc"])
        if proc.returncode == 0 and png_out.exists():
            return png_out, errors, warnings
        warnings.append(CompilerMessage(message=f"pdftoppm failed rc={proc.returncode}"))

    # Try ImageMagick convert
    convert = shutil.which("convert")
    if convert:
        proc = run_cmd([convert, "-density", "300", str(pdf_path), str(png_out)])
        if proc.returncode == 0 and png_out.exists():
            return png_out, errors, warnings
        warnings.append(CompilerMessage(message=f"ImageMagick convert failed"))

    # Try Ghostscript
    gs = shutil.which("gs")
    if gs:
        proc = run_cmd([
            gs, "-dNOPAUSE", "-dBATCH", "-sDEVICE=png16m", "-r300",
            f"-sOutputFile={png_out}", str(pdf_path)
        ])
        if proc.returncode == 0 and png_out.exists():
            return png_out, errors, warnings
        warnings.append(CompilerMessage(message=f"Ghostscript failed to convert PDF"))

    errors.append(CompilerMessage(message="No PNG converter available (install poppler-utils, imagemagick, or ghostscript)", suggest="sudo apt install poppler-utils imagemagick ghostscript"))
    return None, errors, warnings
