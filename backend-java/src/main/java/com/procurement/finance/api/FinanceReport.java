package com.procurement.finance.api;

// 渲染后的报表文件:内容字节流 + 下载文件名 + MIME 类型。
public record FinanceReport(byte[] content, String filename, String contentType) {

  public static final String XLSX_CONTENT_TYPE =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  public static final String PDF_CONTENT_TYPE = "application/pdf";
}
