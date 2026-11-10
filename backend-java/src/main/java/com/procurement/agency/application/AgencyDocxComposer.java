package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import java.io.*;
import java.math.BigInteger;
import java.util.*;
import java.util.regex.*;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.springframework.stereotype.Component;

@Component
public class AgencyDocxComposer {
  public String expand(String text, Map<String, String> fields) {
    var matcher = Pattern.compile("\\{\\{([^{}]+)}}").matcher(text == null ? "" : text);
    StringBuffer out = new StringBuffer();
    while (matcher.find()) {
      String key = matcher.group(1);
      String value =
          Set.of("supplierName", "awardAmount").contains(key) ? "（待成交后填写）" : fields.get(key);
      matcher.appendReplacement(
          out, Matcher.quoteReplacement(value == null ? matcher.group() : value));
    }
    matcher.appendTail(out);
    return out.toString();
  }

  public byte[] compose(String title, List<Chapter> chapters, Map<String, String> fields) {
    try (var doc = new XWPFDocument();
        var out = new ByteArrayOutputStream()) {
      var styles = doc.createStyles();
      for (String id : List.of("Title", "Heading1")) {
        var style = CTStyle.Factory.newInstance();
        style.setStyleId(id);
        style.setType(STStyleType.PARAGRAPH);
        style.addNewName().setVal(id);
        style.addNewRPr().addNewColor().setVal("000000");
        if (id.equals("Heading1")) style.addNewPPr().addNewOutlineLvl().setVal(BigInteger.ZERO);
        styles.addStyle(new XWPFStyle(style));
      }
      var section = doc.getDocument().getBody().addNewSectPr();
      var page = section.addNewPgSz();
      page.setW(BigInteger.valueOf(11906));
      page.setH(BigInteger.valueOf(16838));
      var margin = section.addNewPgMar();
      margin.setTop(BigInteger.valueOf(1134));
      margin.setBottom(BigInteger.valueOf(1134));
      margin.setLeft(BigInteger.valueOf(1134));
      margin.setRight(BigInteger.valueOf(1134));
      var heading = doc.createParagraph();
      heading.setStyle("Title");
      var run = heading.createRun();
      font(run, 20, true);
      run.setText(title);
      var info = doc.createParagraph();
      var r = info.createRun();
      font(r, 10, false);
      r.setText(
          fields.getOrDefault("projectNumber", "")
              + "  "
              + fields.getOrDefault("procurementMethod", "")
              + "  "
              + fields.getOrDefault("purchaserName", ""));
      var tocTitle = doc.createParagraph();
      var tr = tocTitle.createRun();
      font(tr, 14, true);
      tr.setText("目录");
      var toc = doc.createParagraph();
      var tocField = toc.getCTP().addNewFldSimple();
      tocField.setInstr("TOC \\o \"1-1\" \\h \\z \\u");
      tocField.addNewR().addNewT().setStringValue("请在 Word 中更新目录域以显示页码");
      doc.enforceUpdateFields();
      for (var c : chapters) {
        var p = doc.createParagraph();
        p.setStyle("Heading1");
        var h = p.createRun();
        font(h, 14, true);
        h.setText(c.title());
        String body = expand(c.body(), fields);
        for (String line : (body.isBlank() ? "（待完善）" : body).split("\\R", -1)) {
          var paragraph = doc.createParagraph();
          paragraph.setSpacingAfter(100);
          var bodyRun = paragraph.createRun();
          font(bodyRun, 11, false);
          bodyRun.setText(line);
        }
      }
      var footer = doc.createFooter(org.apache.poi.wp.usermodel.HeaderFooterType.DEFAULT);
      var p = footer.createParagraph();
      p.setAlignment(ParagraphAlignment.CENTER);
      var fr = p.createRun();
      font(fr, 9, false);
      fr.setText("第 ");
      p.getCTP().addNewFldSimple().setInstr("PAGE");
      p.createRun().setText(" 页");
      doc.getProperties().getCoreProperties().setTitle(title);
      doc.getProperties().getCoreProperties().setCreator("24Bm");
      doc.write(out);
      return out.toByteArray();
    } catch (IOException e) {
      throw new IllegalStateException("DOCX合成失败", e);
    }
  }

  private void font(XWPFRun run, int size, boolean bold) {
    run.setFontFamily("Arial");
    run.setFontFamily("Noto Sans CJK SC", XWPFRun.FontCharRange.eastAsia);
    run.setFontSize(size);
    run.setBold(bold);
    run.setColor("000000");
  }
}
