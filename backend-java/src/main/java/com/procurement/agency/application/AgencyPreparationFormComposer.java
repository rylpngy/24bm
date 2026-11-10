package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyExecutionRecords.PreparationPerson;
import java.io.*;
import java.math.BigInteger;
import java.util.*;
import org.apache.poi.wp.usermodel.HeaderFooterType;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.springframework.stereotype.Component;

@Component
public class AgencyPreparationFormComposer {
  public static final Map<String, String> ROLES =
      Map.of(
          "purchaser_rep",
          "采购人代表",
          "review_member",
          "评审成员",
          "leader",
          "组长",
          "qualification_reviewer",
          "资格审查人员",
          "conformity_reviewer",
          "符合性审查人员",
          "organizer",
          "项目组织人员",
          "supervisor",
          "监督人员",
          "other",
          "其他准备人员");
  public static final Map<String, String> KINDS =
      Map.of(
          "attendance",
          "人员签到表",
          "disclosure",
          "回避事项声明表",
          "confidentiality",
          "保密承诺表",
          "integrity",
          "廉洁承诺表");

  public byte[] compose(
      String title,
      String code,
      String kind,
      List<PreparationPerson> people,
      Map<String, String> fields,
      String body) {
    try (var doc = new XWPFDocument();
        var out = new ByteArrayOutputStream()) {
      var styles = doc.createStyles();
      var titleStyle = CTStyle.Factory.newInstance();
      titleStyle.setStyleId("Title");
      titleStyle.setType(STStyleType.PARAGRAPH);
      titleStyle.addNewName().setVal("Title");
      titleStyle.addNewRPr().addNewColor().setVal("000000");
      styles.addStyle(new XWPFStyle(titleStyle));
      var section = doc.getDocument().getBody().addNewSectPr();
      var pg = section.addNewPgSz();
      pg.setW(BigInteger.valueOf(11906));
      pg.setH(BigInteger.valueOf(16838));
      var margin = section.addNewPgMar();
      margin.setTop(BigInteger.valueOf(1134));
      margin.setBottom(BigInteger.valueOf(1134));
      margin.setLeft(BigInteger.valueOf(1134));
      margin.setRight(BigInteger.valueOf(1134));
      var heading = doc.createParagraph();
      heading.setStyle("Title");
      heading.setAlignment(ParagraphAlignment.CENTER);
      heading.setSpacingAfter(220);
      text(heading, title, 18, true);
      para(doc, "项目名称：" + fields.getOrDefault("projectTitle", ""), 11, false);
      para(
          doc,
          "采购编号："
              + fields.getOrDefault("projectNumber", "")
              + "    采购方式："
              + fields.getOrDefault("procurementMethod", ""),
          10,
          false);
      para(
          doc,
          "计划时间："
              + fields.getOrDefault("scheduledAt", "未设置")
              + "    场地："
              + fields.getOrDefault("venue", "未设置"),
          10,
          false);
      para(doc, "请按实际情况填写空白栏。生成表单不代表人员已到场或已签署。", 10, false);
      para(doc, "填写后请由项目工作人员核对并回传签署件。", 10, false);
      if (!"attendance".equals(kind)) {
        var person = people.getFirst();
        para(doc, "姓名：" + person.name() + "    准备职责：" + ROLES.get(person.role()), 11, true);
        para(doc, "单位：" + person.organization(), 11, false);
      }
      if (!body.isBlank()) for (String line : body.split("\\R", -1)) para(doc, line, 11, false);
      if ("attendance".equals(kind)) {
        var table = doc.createTable(people.size() + 1, 5);
        int[] widths = {700, 1700, 3500, 1700, 2000};
        table.setWidth(9600);
        table.setTopBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "D9D9D9");
        table.setBottomBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "D9D9D9");
        table.setLeftBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "D9D9D9");
        table.setRightBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "D9D9D9");
        table.setInsideHBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "D9D9D9");
        table.setInsideVBorder(XWPFTable.XWPFBorderType.SINGLE, 4, 0, "D9D9D9");
        table.setCellMargins(110, 110, 110, 110);
        String[] headers = {"序号", "姓名", "单位与准备职责", "本人签名", "实际到场时间"};
        for (int i = 0; i < 5; i++) cell(table.getRow(0).getCell(i), headers[i], widths[i], true);
        table.getRow(0).setRepeatHeader(true);
        for (int n = 0; n < people.size(); n++) {
          var p = people.get(n);
          var row = table.getRow(n + 1);
          row.setHeight(600);
          row.setHeightRule(TableRowHeightRule.AT_LEAST);
          row.setCantSplitRow(true);
          String[] values = {
            Integer.toString(n + 1), p.name(), p.organization() + "\n" + ROLES.get(p.role()), "", ""
          };
          for (int i = 0; i < 5; i++) cell(row.getCell(i), values[i], widths[i], false);
        }
        para(doc, "现场核对人：________________    核对日期：________________", 11, false);
      } else {

        para(doc, "本人补充说明（如有）：", 11, false);
        for (int i = 0; i < 3; i++)
          para(
              doc, "__________________________________________________________________", 10, false);
        para(doc, "本人签名：________________    签署日期：________________", 11, false);
      }
      var footer = doc.createFooter(HeaderFooterType.DEFAULT);
      var fp = footer.createParagraph();
      fp.setAlignment(ParagraphAlignment.CENTER);
      text(fp, "表单编号 " + code + "    第 ", 8, false);
      fp.getCTP().addNewFldSimple().setInstr("PAGE");
      text(fp, " 页", 8, false);
      doc.getProperties().getCoreProperties().setTitle(title);
      doc.getProperties().getCoreProperties().setCreator("24Bm");
      doc.write(out);
      return out.toByteArray();
    } catch (IOException e) {
      throw new IllegalStateException("人员表单生成失败", e);
    }
  }

  private void para(XWPFDocument doc, String value, int size, boolean bold) {
    var p = doc.createParagraph();
    p.setSpacingAfter(140);
    p.setIndentationRight(120);
    text(p, value, size, bold);
  }

  private void text(XWPFParagraph p, String value, int size, boolean bold) {
    var r = p.createRun();
    r.setFontFamily("Arial");
    r.setFontFamily("Noto Sans CJK SC", XWPFRun.FontCharRange.eastAsia);
    r.setFontSize(size);
    r.setBold(bold);
    r.setColor("000000");
    r.setText(value);
  }

  private void cell(XWPFTableCell c, String value, int width, boolean header) {
    c.setWidth(Integer.toString(width));
    c.setVerticalAlignment(XWPFTableCell.XWPFVertAlign.CENTER);
    if (header) c.setColor("F1F5F9");
    var p = c.getParagraphs().getFirst();
    p.setAlignment(width <= 1700 ? ParagraphAlignment.CENTER : ParagraphAlignment.LEFT);
    p.setSpacingAfter(60);
    String[] lines = value.split("\\R", -1);
    for (int n = 0; n < lines.length; n++) {
      if (n > 0) p.createRun().addBreak();
      text(p, lines[n], 10, header);
    }
  }
}
