"""Self-test the artifact checker with synthetic files, not product-completion evidence."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("artifact_checker", ROOT / "scripts" / "verify-exports.py")
CHECKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKER)


class ArtifactCheckerTest(unittest.TestCase):
    def setUp(self):
        (ROOT / "output" / "self-tests").mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=ROOT / "output" / "self-tests")
        self.folder = Path(self.temp.name)
        image = Image.new("RGB", (1240, 1748), "white")
        image.save(self.folder / "page.png", dpi=(300, 300))
        image.save(self.folder / "raw.pdf", resolution=300)
        writer = PdfWriter()
        writer.add_page(PdfReader(self.folder / "raw.pdf").pages[0])
        writer.pages[0].mediabox = RectangleObject([0, 0, 105 * 72 / 25.4, 148 * 72 / 25.4])
        writer.write(self.folder / "book.pdf")
        self.manifest = {"schemaVersion": 1, "expectedPages": 1, "dpi": 300, "pngPageNumber": 1, "png": "page.png", "pdf": "book.pdf"}
        self.save_manifest()

    def tearDown(self):
        self.temp.cleanup()

    def save_manifest(self):
        (self.folder / "manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")

    def verify(self):
        return CHECKER.verify(self.folder / "manifest.json", "slice-1", "raster")

    def test_correct_a6_raster_artifact_passes(self):
        self.assertTrue(self.verify()["pngPdfPixelMatch"])

    def test_selected_b6_dimensions_are_verified(self):
        image = Image.new("RGB", (1512, 2150), "white")
        image.save(self.folder / "page.png", dpi=(300, 300))
        image.save(self.folder / "raw.pdf", resolution=300)
        writer = PdfWriter()
        writer.add_page(PdfReader(self.folder / "raw.pdf").pages[0])
        writer.pages[0].mediabox = RectangleObject([0, 0, 128 * 72 / 25.4, 182 * 72 / 25.4])
        writer.write(self.folder / "book.pdf")
        self.manifest["pageMm"] = [128, 182]
        self.save_manifest()
        self.assertEqual(self.verify()["pageMm"], [128, 182])

    def test_wrong_pdf_size_fails(self):
        writer = PdfWriter()
        writer.add_page(PdfReader(self.folder / "book.pdf").pages[0])
        writer.pages[0].mediabox = RectangleObject([0, 0, 100, 100])
        writer.write(self.folder / "book.pdf")
        with self.assertRaisesRegex(AssertionError, "width differs"):
            self.verify()

    def test_changed_png_pixel_fails(self):
        with Image.open(self.folder / "page.png") as image:
            image.putpixel((10, 10), (0, 0, 0))
            image.save(self.folder / "page.png", dpi=(300, 300))
        with self.assertRaisesRegex(AssertionError, "pixels differ"):
            self.verify()

    def test_missing_dpi_fails(self):
        Image.new("RGB", (1240, 1748), "white").save(self.folder / "page.png")
        with self.assertRaisesRegex(AssertionError, "DPI"):
            self.verify()

    def test_wrong_page_count_fails(self):
        self.manifest["expectedPages"] = 2
        self.save_manifest()
        with self.assertRaisesRegex(AssertionError, "page count"):
            self.verify()

    def test_unsupported_text_profile_cannot_pass(self):
        with self.assertRaisesRegex(ValueError, "TEXT_PDF_NOT_VERIFIED"):
            CHECKER.verify(self.folder / "manifest.json", "slice-1", "text")


if __name__ == "__main__":
    unittest.main()
