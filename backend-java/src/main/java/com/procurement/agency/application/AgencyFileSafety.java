package com.procurement.agency.application;

import java.io.*;
import java.nio.*;
import java.nio.charset.*;
import java.util.*;
import java.util.zip.*;
import org.springframework.stereotype.Component;

@Component
public class AgencyFileSafety {
  public static final int MAX_BYTES = 10 * 1024 * 1024;

  public void inspect(String name, byte[] bytes) {
    if (name == null
        || name.contains("/")
        || name.contains("\\")
        || name.contains("..")
        || name.length() > 200) throw new IllegalArgumentException("文件名含非法路径或过长");
    if (bytes.length == 0 || bytes.length > MAX_BYTES)
      throw new IllegalArgumentException("附件须大于0且不超过10MB");
    String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    String content = new String(bytes, StandardCharsets.ISO_8859_1);
    if (content.contains("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")
        || content.startsWith("MZ")
        || content.startsWith("#!")) throw new IllegalArgumentException("检测到可疑或可执行内容，拒绝封存");
    switch (ext) {
      case "docx", "xlsx" -> inspectZip(bytes, ext);
      case "pdf" -> {
        if (!content.startsWith("%PDF-")
            || content.contains("/JavaScript")
            || content.contains("/Launch")
            || content.matches("(?s).*/JS[\\s/].*"))
          throw new IllegalArgumentException("PDF格式错误或含活动脚本");
      }
      case "png" -> {
        if (bytes.length < 8
            || !java.util.HexFormat.of().formatHex(bytes, 0, 8).equals("89504e470d0a1a0a"))
          throw new IllegalArgumentException("PNG内容与扩展名不符");
      }
      case "jpg", "jpeg" -> {
        if (bytes.length < 3
            || (bytes[0] & 255) != 255
            || (bytes[1] & 255) != 216
            || (bytes[2] & 255) != 255) throw new IllegalArgumentException("JPEG内容与扩展名不符");
      }
      case "txt", "csv" -> {
        try {
          StandardCharsets.UTF_8
              .newDecoder()
              .onMalformedInput(CodingErrorAction.REPORT)
              .decode(ByteBuffer.wrap(bytes));
        } catch (CharacterCodingException e) {
          throw new IllegalArgumentException("文本须使用UTF-8编码");
        }
      }
      default -> throw new IllegalArgumentException("仅支持DOCX、XLSX、PDF、PNG、JPEG及UTF-8文本；禁止宏文件");
    }
  }

  private void inspectZip(byte[] bytes, String ext) {
    boolean root = false, document = false;
    long total = 0;
    int count = 0;
    try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
      ZipEntry entry;
      byte[] buf = new byte[8192];
      while ((entry = zip.getNextEntry()) != null) {
        String name = entry.getName().toLowerCase(Locale.ROOT);
        if (++count > 5000
            || name.contains("..")
            || name.startsWith("/")
            || name.contains("\\")
            || name.contains("vbaproject")
            || name.contains("/embeddings/")
            || name.endsWith(".exe")
            || name.endsWith(".js")) throw new IllegalArgumentException("Office压缩包含非法路径、宏或嵌入程序");
        if (name.equals("[content_types].xml")) root = true;
        if (name.equals(ext.equals("docx") ? "word/document.xml" : "xl/workbook.xml"))
          document = true;
        int size;
        while ((size = zip.read(buf)) != -1) {
          total += size;
          if (total > 60L * 1024 * 1024) throw new IllegalArgumentException("Office解压大小超过60MB");
        }
      }
    } catch (IOException e) {
      throw new IllegalArgumentException("Office文件损坏");
    }
    if (!root || !document) throw new IllegalArgumentException("Office内容与扩展名不符");
  }
}
