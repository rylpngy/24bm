package com.procurement.attachment.application;

import com.procurement.common.document.LocalDocumentTools;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.*;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.*;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

@Component
public class PdfTextExtractor {
  final LocalDocumentTools tools;

  public PdfTextExtractor(LocalDocumentTools tools) {
    this.tools = tools;
  }

  public AttachmentTextExtractor.Extraction extract(String name, byte[] bytes) {
    var rows = new ArrayList<AttachmentTextExtractor.Segment>();
    var limits = new ArrayList<String>();
    int count = 0;
    long deadline = System.nanoTime() + java.time.Duration.ofSeconds(90).toNanos();
    try {
      String lower = name.toLowerCase(Locale.ROOT);
      if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
        BufferedImage image = readImage(bytes);
        String text = tools.ocr(png(image));
        add(rows, "image:1/ocr", text, limits);
        limits.add("本地OCR识别结果可能有字形、数字或表格行列误差，须对照原图人工确认；未调用生成式AI");
        return new AttachmentTextExtractor.Extraction(rows, limits);
      }
      try (PDDocument doc = Loader.loadPDF(bytes)) {
        if (doc.isEncrypted() || !doc.getCurrentAccessPermission().canExtractContent())
          return unsupported("PDF受加密或提取权限限制，未绕过保护，请提供可读副本");
        int pages = Math.min(doc.getNumberOfPages(), 20);
        if (doc.getNumberOfPages() > 20) limits.add("PDF最多处理前20页，其余页未提取");
        var stripper = new PDFTextStripper();
        stripper.setSortByPosition(true);
        var renderer = new PDFRenderer(doc);
        int ocr = 0;
        for (int i = 0; i < pages; i++) {
          if (System.nanoTime() > deadline) {
            limits.add("达到90秒处理时限，后续页未提取");
            break;
          }
          stripper.setStartPage(i + 1);
          stripper.setEndPage(i + 1);
          StringWriter text = new StringWriter();
          final int remaining = 40000 - count;
          Writer bounded =
              new Writer() {
                int n;

                public void write(char[] c, int o, int l) throws IOException {
                  if (n + l > Math.max(0, remaining)) throw new IOException("Text cap");
                  text.write(c, o, l);
                  n += l;
                }

                public void flush() {}

                public void close() {}
              };
          stripper.writeText(doc, bounded);
          String value = text.toString();
          String method = "text";
          if (value.isBlank()) {
            if (!tools.ocrConfigured()) {
              limits.add("第" + (i + 1) + "页无文本层且本地OCR未启用，保留原页待人工处理");
              continue;
            }
            if (++ocr > 10) {
              limits.add("最多OCR识别10页，其余扫描页未提取");
              continue;
            }
            var box = doc.getPage(i).getCropBox();
            double pixels = (double) box.getWidth() * box.getHeight() * 4;
            if (box.getWidth() <= 0 || box.getHeight() <= 0 || pixels > 12_000_000)
              throw new IllegalArgumentException("扫描页尺寸超过OCR上限");
            value = tools.ocr(png(renderer.renderImageWithDPI(i, 144, ImageType.RGB)));
            method = "ocr";
          }
          if (value.length() + count > 40000) {
            limits.add("达到4万字符上限，当前及后续内容未提取");
            break;
          }
          add(rows, "page:" + (i + 1) + "/" + method, value, limits);
          count += value.length();
          if (rows.size() >= 160) {
            limits.add("达到160段上限，后续内容未提取");
            break;
          }
        }
      }
      limits.add("PDF文本顺序不等于表格语义，OCR及跨行列内容须对照原页面核对；未提取图片或附件中的隐含内容");
      if (rows.isEmpty()) limits.add("未取得可读文本，不代表没有采购要求，须人工维护");
      return new AttachmentTextExtractor.Extraction(List.copyOf(rows), List.copyOf(limits));
    } catch (Exception e) {
      return unsupported(
          e instanceof IllegalStateException ? e.getMessage() : "PDF或扫描件无法在处理限制内读取，原附件保留，正文未评估");
    }
  }

  static BufferedImage readImage(byte[] bytes) throws IOException {
    try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
      var readers = ImageIO.getImageReaders(input);
      if (!readers.hasNext()) throw new IOException();
      var r = readers.next();
      try {
        r.setInput(input);
        if ((long) r.getWidth(0) * r.getHeight(0) > 12_000_000) throw new IOException();
        return r.read(0);
      } finally {
        r.dispose();
      }
    }
  }

  static byte[] png(BufferedImage image) throws IOException {
    try (var out = new ByteArrayOutputStream()) {
      if (!ImageIO.write(image, "png", out)) throw new IOException();
      return out.toByteArray();
    }
  }

  static void add(
      List<AttachmentTextExtractor.Segment> rows,
      String locator,
      String text,
      List<String> limits) {
    int line = 0, total = rows.stream().mapToInt(s -> s.text().length()).sum();
    for (var value : text.split("\\R")) {
      line++;
      if (value.isBlank()) continue;
      if (rows.size() >= 160 || value.length() > 4000 || total + value.length() > 40000) {
        limits.add("文本段落或字符超出上限，其余内容未提取");
        break;
      }
      rows.add(new AttachmentTextExtractor.Segment(locator + "/line:" + line, value));
      total += value.length();
    }
  }

  static AttachmentTextExtractor.Extraction unsupported(String text) {
    return new AttachmentTextExtractor.Extraction(List.of(), List.of(text));
  }
}
