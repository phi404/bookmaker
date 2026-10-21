"""Check real artifacts. No synthetic PDF or golden file is used as completion evidence."""
from pathlib import Path
import io
import json
import math
import sys
import zipfile


def artifact_path(folder, name):
    candidate = (folder / name).resolve()
    if not candidate.is_relative_to(folder.resolve()):
        raise ValueError("Artifact path escapes export directory")
    if not candidate.is_file():
        raise ValueError(f"Missing artifact: {name}")
    return candidate


def verify_navigation(reader, expected):
    outline = []
    def visit(items, depth=1):
        for item in items:
            if isinstance(item, list):
                visit(item, depth + 1)
            else:
                outline.append({"title": item.title, "page": reader.get_destination_page_number(item) + 1, "depth": depth})
    visit(reader.outline)
    assert outline == expected["outlines"], f"PDF outline destinations differ: {outline}"
    refs = {(p.indirect_reference.idnum, p.indirect_reference.generation): i + 1 for i, p in enumerate(reader.pages)}
    targets = []
    for page in reader.pages:
        for raw in page.get("/Annots", []):
            annotation = raw.get_object()
            assert annotation.get("/Subtype") == "/Link" and "/A" not in annotation, "Unexpected PDF action"
            dest = annotation["/Dest"][0]
            targets.append(refs[(dest.idnum, dest.generation)])
            x1, y1, x2, y2 = map(float, annotation["/Rect"])
            assert 0 <= x1 < x2 <= float(page.mediabox.width) and 0 <= y1 < y2 <= float(page.mediabox.height), "PDF link rectangle is outside paper"
    assert targets == expected["linkTargets"], f"PDF links differ or reference an excluded page: {targets}"
    assert reader.trailer["/Root"]["/ViewerPreferences"]["/Direction"] == "/" + expected["direction"], "PDF reading direction differs"


def verify(manifest_path, phase, profile):
    if profile != "raster":
        raise ValueError("TEXT_PDF_NOT_VERIFIED: text/embedded-font verification must be implemented before selecting this profile")
    from pypdf import PdfReader
    from PIL import Image, ImageChops

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    folder = manifest_path.parent
    if manifest.get("schemaVersion") != 1:
        raise ValueError("Unsupported artifact manifest")
    expected_pages = manifest["expectedPages"]
    dpi = manifest["dpi"]
    page_mm = manifest.get("pageMm", [105, 148])
    assert len(page_mm) == 2 and all(isinstance(x, (int, float)) and 0 < x <= 350 for x in page_mm)
    expected_size = tuple(math.floor(x * dpi / 25.4 + 0.5) for x in page_mm)
    reader = PdfReader(artifact_path(folder, manifest["pdf"]))
    assert len(reader.pages) == expected_pages, "PDF page count differs from layout"
    images = []
    for page in reader.pages:
        assert abs(float(page.mediabox.width) * 25.4 / 72 - page_mm[0]) < 0.01, "PDF width differs from selected size"
        assert abs(float(page.mediabox.height) * 25.4 / 72 - page_mm[1]) < 0.01, "PDF height differs from selected size"
        assert len(page.images) == 1, "raster profile requires one full-page image per page"
        images.append(page.images[0].image.convert("RGB"))
        assert images[-1].size == expected_size, "PDF image size differs from export resolution"
    for sample in manifest.get("colorSamples", []):
        page_number, position, rgb = sample["page"], sample["position"], sample["rgb"]
        assert isinstance(page_number, int) and 1 <= page_number <= expected_pages
        assert len(position) == 2 and all(isinstance(v, (int, float)) and 0 <= v < 1 for v in position)
        assert len(rgb) == 3 and all(isinstance(v, int) and 0 <= v <= 255 for v in rgb)
        pixel = images[page_number - 1].getpixel(tuple(math.floor(size * ratio) for size, ratio in zip(expected_size, position)))
        assert pixel == tuple(rgb), f"Physical page {page_number} has the wrong image half: {pixel} != {rgb}"
    if "navigation" in manifest:
        verify_navigation(reader, manifest["navigation"])
    for case in manifest.get("navigationRanges", []):
        subset = PdfReader(artifact_path(folder, case["pdf"]))
        assert len(subset.pages) == len(case["pages"]), "Range PDF page count differs"
        verify_navigation(subset, case["navigation"])
        for sheet, source_number in zip(subset.pages, case["pages"]):
            assert len(sheet.images) == 1
            assert ImageChops.difference(sheet.images[0].image.convert("RGB"), images[source_number - 1]).getbbox() is None, "Range PDF changed the source paper"
    with Image.open(artifact_path(folder, manifest["png"])) as png:
        assert png.size == expected_size, "PNG dimensions differ from selected size and DPI"
        assert all(abs(value - dpi) < 0.02 for value in png.info.get("dpi", (0, 0))), "PNG DPI is missing/wrong"
        selected = manifest["pngPageNumber"]
        assert 1 <= selected <= expected_pages
        assert ImageChops.difference(images[selected - 1], png.convert("RGB")).getbbox() is None, "PNG/PDF pixels differ"
    if phase == "mvp":
        with zipfile.ZipFile(artifact_path(folder, manifest["zip"])) as archive:
            names = sorted(name for name in archive.namelist() if name.endswith(".png"))
            assert len(names) == expected_pages, "ZIP page count differs"
            for index, name in enumerate(names):
                with Image.open(io.BytesIO(archive.read(name))) as png:
                    assert png.size == expected_size
                    assert ImageChops.difference(images[index], png.convert("RGB")).getbbox() is None, "ZIP/PDF page pixels differ"
        with Image.open(artifact_path(folder, manifest["spread"])) as spread:
            width, height = expected_size
            assert spread.size == (width * 2, height), "Spread dimensions differ"
            for side, offset in [("left", 0), ("right", width)]:
                page_number = manifest["spreadPages"][side]
                assert ImageChops.difference(spread.crop((offset, 0, offset + width, height)).convert("RGB"), images[page_number - 1]).getbbox() is None, f"Spread {side} page differs"
    return {"profile": profile, "pages": expected_pages, "pageMm": page_mm, "pngPixels": list(expected_size), "dpi": dpi, "pngPdfPixelMatch": True, "embeddedTextVerified": False, "navigationVerified": "navigation" in manifest, "navigationRangeCases": len(manifest.get("navigationRanges", []))}


if __name__ == "__main__":
    try:
        print(json.dumps(verify(Path(sys.argv[1]), sys.argv[2], sys.argv[3]), ensure_ascii=False))
    except Exception as error:
        print(f"EXPORT_VERIFICATION_FAILED: {error}", file=sys.stderr)
        sys.exit(1)
