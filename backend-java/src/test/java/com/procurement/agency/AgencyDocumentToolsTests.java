package com.procurement.agency;

import static org.junit.jupiter.api.Assertions.*;

import com.procurement.agency.application.AgencyDocumentPreviewService;
import com.procurement.attachment.application.*;
import com.procurement.common.document.LocalDocumentTools;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.*;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.encryption.*;
import org.apache.pdfbox.pdmodel.font.*;
import org.apache.poi.xwpf.usermodel.*;
import org.junit.jupiter.api.Test;

class AgencyDocumentToolsTests {
  final LocalDocumentTools disabled =
      new LocalDocumentTools(false, "missing-tesseract", "", "missing-soffice");

  byte[] zip(String name, byte[] xml) throws Exception {
    var out = new ByteArrayOutputStream();
    try (var z = new ZipOutputStream(out)) {
      z.putNextEntry(new ZipEntry(name));
      z.write(xml);
      z.closeEntry();
    }
    return out.toByteArray();
  }

  @Test
  void rejectsExternalResourcesAndUtf16SplitFields() throws Exception {
    String body =
        "<?xml version=\"1.0\" encoding=\"UTF-16\"?><w:document"
            + " xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:instrText>INCLUDE</w:instrText><w:instrText>TEXT</w:instrText></w:document>";
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyDocumentPreviewService.safeForConversion(
                zip("word/document.xml", body.getBytes(StandardCharsets.UTF_16))));
    String link =
        "<w:document"
            + " xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:fldSimple"
            + " w:instr=\" LINK Excel.Sheet.12 file:///private/data \"><w:r><w:t>visible"
            + " result</w:t></w:r></w:fldSimple></w:document>";
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyDocumentPreviewService.safeForConversion(
                zip("word/document.xml", link.getBytes(StandardCharsets.UTF_8))));
    String rel =
        "<Relationships><Relationship TargetMode=\"External\" Type=\"image\""
            + " Target=\"http://127.0.0.1/private\"/></Relationships>";
    assertThrows(
        IllegalArgumentException.class,
        () ->
            AgencyDocumentPreviewService.safeForConversion(
                zip("word/_rels/document.xml.rels", rel.getBytes())));
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyDocumentPreviewService.safeForConversion("not zip".getBytes()));
  }

  @Test
  void textPdfKeepsPageSourceAndProtectedPdfHasNoConclusion() throws Exception {
    try (var doc = new PDDocument()) {
      var page = new PDPage();
      doc.addPage(page);
      try (var stream = new PDPageContentStream(doc, page)) {
        stream.beginText();
        stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
        stream.newLineAtOffset(50, 700);
        stream.showText("Delivery within 30 days");
        stream.endText();
      }
      var bytes = new ByteArrayOutputStream();
      doc.save(bytes);
      var result = new PdfTextExtractor(disabled).extract("requirements.pdf", bytes.toByteArray());
      assertEquals("page:1/text/line:1", result.segments().getFirst().locator());
      assertTrue(result.segments().getFirst().text().contains("30 days"));
      var access = new AccessPermission();
      access.setCanExtractContent(false);
      doc.protect(new StandardProtectionPolicy("owner", "", access));
      bytes.reset();
      doc.save(bytes);
      assertTrue(
          new PdfTextExtractor(disabled)
              .extract("locked.pdf", bytes.toByteArray())
              .segments()
              .isEmpty());
    }
  }

  @Test
  void scannedPageNeverClaimsTextWhenOcrUnconfigured() throws Exception {
    try (var doc = new PDDocument()) {
      doc.addPage(new PDPage());
      var out = new ByteArrayOutputStream();
      doc.save(out);
      var result = new PdfTextExtractor(disabled).extract("scan.pdf", out.toByteArray());
      assertTrue(result.segments().isEmpty());
      assertTrue(result.limitations().stream().anyMatch(x -> x.contains("OCR未启用")));
    }
  }

  @Test
  void tableSourceIncludesCellAndParagraphAndSafeDocxConvertsOnlyWhenConfigured() throws Exception {
    try (var doc = new XWPFDocument()) {
      doc.createParagraph().createRun().setText("采购说明");
      var table = doc.createTable(1, 2);
      table.getRow(0).getCell(0).setText("交付期");
      table.getRow(0).getCell(1).setText("30天");
      var out = new ByteArrayOutputStream();
      doc.write(out);
      AgencyDocumentPreviewService.safeForConversion(out.toByteArray());
      var extracted = new AttachmentTextExtractor().extract("采购.docx", out.toByteArray());
      assertTrue(
          extracted.segments().stream()
              .anyMatch(
                  s ->
                      s.locator().equals("table:1/row:1/cell:2/paragraph:1")
                          && s.text().equals("30天")));
      assertThrows(IllegalStateException.class, () -> disabled.pdf(out.toByteArray()));
    }
  }

  @Test
  @org.junit.jupiter.api.condition.EnabledIfSystemProperty(
      named = "agency.document.integration",
      matches = "true")
  void actualLocalOcrAndLibreOfficeConversion() throws Exception {
    var root = java.nio.file.Path.of("..").toAbsolutePath().normalize();
    var tools =
        new LocalDocumentTools(
            true,
            "/opt/homebrew/bin/tesseract",
            root.resolve(".p0/ocr-tessdata").toString(),
            "/Applications/LibreOffice.app/Contents/MacOS/soffice");
    var image =
        new java.awt.image.BufferedImage(1800, 350, java.awt.image.BufferedImage.TYPE_INT_RGB);
    var g = image.createGraphics();
    g.setColor(java.awt.Color.WHITE);
    g.fillRect(0, 0, 1800, 350);
    g.setColor(java.awt.Color.BLACK);
    g.setFont(new java.awt.Font("PingFang SC", java.awt.Font.PLAIN, 64));
    g.drawString("采购内容：办公设备", 50, 110);
    g.drawString("Delivery within 30 days", 50, 230);
    g.dispose();
    var out = new ByteArrayOutputStream();
    javax.imageio.ImageIO.write(image, "png", out);
    var extracted = new PdfTextExtractor(tools).extract("scan.png", out.toByteArray());
    assertFalse(extracted.segments().isEmpty(), extracted.limitations().toString());
    String text = extracted.segments().toString();
    assertTrue(text.contains("30"), text);
    assertTrue(text.contains("采购"), text);
    try (var doc = new XWPFDocument()) {
      doc.createParagraph().createRun().setText("采购技术验证 Technical preview 30 days");
      out.reset();
      doc.write(out);
      AgencyDocumentPreviewService.safeForConversion(out.toByteArray());
      byte[] pdf = tools.pdf(out.toByteArray());
      try (var loaded = org.apache.pdfbox.Loader.loadPDF(pdf)) {
        assertTrue(loaded.getNumberOfPages() > 0);
        assertTrue(
            new org.apache.pdfbox.text.PDFTextStripper().getText(loaded).contains("30 days"));
      }
    }
  }

  @Test
  void externalRelationshipCannotHideBehindOtherwiseValidDocument() throws Exception {
    var out = new ByteArrayOutputStream();
    try (var z = new ZipOutputStream(out)) {
      z.putNextEntry(new ZipEntry("word/document.xml"));
      z.write("<document/>".getBytes());
      z.closeEntry();
      z.putNextEntry(new ZipEntry("word/_rels/document.xml.rels"));
      z.write(
          "<Relationships><Relationship TargetMode=\"External\" Type=\"image\" Target=\"http://127.0.0.1/private\"/></Relationships>"
              .getBytes());
      z.closeEntry();
    }
    assertThrows(
        IllegalArgumentException.class,
        () -> AgencyDocumentPreviewService.safeForConversion(out.toByteArray()));
  }
}
