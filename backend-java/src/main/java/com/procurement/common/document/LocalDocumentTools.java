package com.procurement.common.document;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Local bounded processes only. No model, cloud upload or caller-supplied command arguments. */
@Component
public class LocalDocumentTools {
  final String tesseract, soffice, tessdata;
  final boolean ocrEnabled;
  final Semaphore slots = new Semaphore(1);

  public LocalDocumentTools(
      @Value("${document.tools.ocr-enabled:false}") boolean ocrEnabled,
      @Value("${document.tools.tesseract:tesseract}") String tesseract,
      @Value("${document.tools.tessdata:}") String tessdata,
      @Value("${document.tools.soffice:soffice}") String soffice) {
    this.ocrEnabled = ocrEnabled;
    this.tesseract = tesseract;
    this.tessdata = tessdata;
    this.soffice = soffice;
  }

  public boolean ocrConfigured() {
    return ocrEnabled;
  }

  public String ocr(byte[] png) {
    if (!ocrEnabled) throw new IllegalStateException("本地OCR尚未配置；扫描页仍保留原附件，请人工确认");
    if (png == null || png.length > 10 * 1024 * 1024)
      throw new IllegalArgumentException("OCR图片超过10MB");
    if (!slots.tryAcquire()) throw new IllegalStateException("本地文档处理繁忙，请稍后重试");
    Path dir = null;
    try {
      dir = Files.createTempDirectory("24bm-ocr-");
      Path image = dir.resolve("page.png"), base = dir.resolve("result");
      Files.write(image, png);
      List<String> args =
          new ArrayList<>(
              List.of(
                  tesseract, image.toString(), base.toString(), "-l", "chi_sim+eng", "--psm", "6"));
      if (!tessdata.isBlank()) {
        args.add("--tessdata-dir");
        args.add(tessdata);
      }
      run(args, dir, 30);
      Path text = dir.resolve("result.txt");
      if (!Files.isRegularFile(text) || Files.size(text) > 160000)
        throw new IllegalStateException("OCR输出缺失或超过文本限制");
      return Files.readString(text);
    } catch (IOException e) {
      throw new IllegalStateException("本地OCR不可用，请检查引擎与语言包；未生成识别结论");
    } finally {
      clean(dir);
      slots.release();
    }
  }

  public byte[] pdf(byte[] docx) {
    if (docx == null || docx.length > 10 * 1024 * 1024)
      throw new IllegalArgumentException("待预览Word超过10MB");
    if (!slots.tryAcquire()) throw new IllegalStateException("本地文档处理繁忙，请稍后重试");
    Path dir = null;
    try {
      dir = Files.createTempDirectory("24bm-preview-");
      Path source = dir.resolve("source.docx");
      Files.write(source, docx);
      run(
          List.of(
              soffice,
              "-env:UserInstallation=" + dir.resolve("profile").toUri(),
              "--headless",
              "--convert-to",
              "pdf",
              "--outdir",
              dir.toString(),
              source.toString()),
          dir,
          40);
      Path out = dir.resolve("source.pdf");
      if (!Files.isRegularFile(out) || Files.size(out) == 0 || Files.size(out) > 10 * 1024 * 1024)
        throw new IllegalStateException("PDF转换未产生有效输出或超过10MB");
      byte[] bytes = Files.readAllBytes(out);
      if (bytes.length < 5 || !new String(bytes, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-"))
        throw new IllegalStateException("转换输出不是PDF");
      return bytes;
    } catch (IOException e) {
      throw new IllegalStateException("本地Word预览服务未配置或转换失败，原DOCX保持可下载");
    } finally {
      clean(dir);
      slots.release();
    }
  }

  void run(List<String> args, Path dir, int seconds) throws IOException {
    Process p =
        new ProcessBuilder(args)
            .directory(dir.toFile())
            .redirectOutput(ProcessBuilder.Redirect.DISCARD)
            .redirectError(ProcessBuilder.Redirect.DISCARD)
            .start();
    try {
      if (!p.waitFor(seconds, TimeUnit.SECONDS)) {
        p.descendants().forEach(ProcessHandle::destroyForcibly);
        p.destroyForcibly();
        throw new IllegalStateException("文档处理超时，未返回部分成功结果");
      }
      if (p.exitValue() != 0) throw new IllegalStateException("本地文档工具返回失败，未生成有效结果");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      p.descendants().forEach(ProcessHandle::destroyForcibly);
      p.destroyForcibly();
      throw new IllegalStateException("文档处理已中断");
    }
  }

  static void clean(Path dir) {
    if (dir == null) return;
    try (var stream = Files.walk(dir)) {
      for (Path p : stream.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(p);
    } catch (IOException ignored) {
      /* private temp directory; no original business files are ever deleted */
    }
  }
}
