package com.procurement.attachment.application;

import java.util.List;
import org.springframework.stereotype.Component;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.util.*;
import java.util.zip.*;
import org.apache.poi.xwpf.usermodel.*;

@Component
public class AttachmentTextExtractor {
  public static final int MAX_BYTES=2*1024*1024;
  private static final int MAX_TEXT=40000,MAX_SEGMENTS=160;
  public record Segment(String locator, String text) {}
  public record Extraction(List<Segment> segments, List<String> limitations) {}
  public Extraction extract(String fileName, byte[] bytes) {
    if(bytes==null || bytes.length>MAX_BYTES) return unsupported("文件为空或超过2MB，正文未评估。");
    String lower=fileName==null?"":fileName.toLowerCase(Locale.ROOT);
    if(!lower.endsWith(".txt") && !lower.endsWith(".docx")) return unsupported("暂不支持此格式（包括PDF及扫描图片），正文未评估。");
    List<Segment> segments=new ArrayList<>(); List<String> limitations=new ArrayList<>();
    long deadline=System.nanoTime()+java.time.Duration.ofSeconds(2).toNanos();
    try {
      if(lower.endsWith(".txt")) {
        String text=StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
        int line=0;
        for(String value:text.split("\\R",-1)) {
          if(!add(segments,"line:"+(++line),value,deadline,limitations)) break;
        }
      } else {
        preflight(bytes,deadline);
        try(var doc=new XWPFDocument(new ByteArrayInputStream(bytes))) {
          int paragraph=0,table=0;
          outer: for(var element:doc.getBodyElements()) {
            if(element instanceof XWPFParagraph p) {
              if(!add(segments,"paragraph:"+(++paragraph),p.getText(),deadline,limitations)) break;
            } else if(element instanceof XWPFTable t) {
              table++; int row=0;
              for(var r:t.getRows()) { row++; int cell=0;
                for(var c:r.getTableCells()) if(!add(segments,"table:"+table+"/row:"+row+"/cell:"+(++cell),c.getText(),deadline,limitations)) break outer;
              }
            }
          }
        }
        limitations.add("仅提取DOCX正文段落及一级表格单元格文本；页眉、图片、嵌入文件及修订语义未评估。");
      }
      if(segments.isEmpty()) limitations.add("未提取到可读文本，正文未评估（未启用OCR）。");
      return new Extraction(List.copyOf(segments),List.copyOf(limitations));
    } catch(Exception error) { return unsupported("文件无法安全读取或格式异常，正文未评估。"); }
  }
  private boolean add(List<Segment> out,String locator,String value,long deadline,List<String> limitations) {
    if(System.nanoTime()>deadline) { limitations.add("已达到文本提取时限，剩余内容未评估。"); return false; }
    if(value==null || value.isBlank()) return true;
    int consumed=out.stream().mapToInt(s -> s.text().length()).sum();
    if(out.size()>=MAX_SEGMENTS || consumed+value.length()>MAX_TEXT || value.length()>4000) {
      limitations.add("已达到文本长度或段落数量上限，剩余内容未评估。"); return false;
    }
    out.add(new Segment(locator,value)); return true;
  }
  private void preflight(byte[] bytes,long deadline) throws IOException {
    long total=0; int entries=0; boolean document=false;
    try(var zip=new ZipInputStream(new ByteArrayInputStream(bytes))) {
      ZipEntry entry; byte[] buffer=new byte[4096];
      while((entry=zip.getNextEntry())!=null) {
        if(++entries>256 || entry.getName().contains("..")) throw new IOException("Unsafe archive");
        if(entry.getName().equals("word/document.xml")) document=true;
        int n;
        while((n=zip.read(buffer))!=-1) {
          total+=n; if(total>8L*MAX_BYTES || System.nanoTime()>deadline) throw new IOException("Document expansion/time limit");
        }
      }
    }
    if(!document) throw new IOException("Missing document body");
  }
  private Extraction unsupported(String message) { return new Extraction(List.of(),List.of(message)); }
}
