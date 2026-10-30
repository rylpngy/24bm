package com.procurement.sourcing.application;

import java.util.*;
import java.io.ByteArrayOutputStream;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;

@Service
public record QuotationComparisonExport(RfqQuotationService service,RfqItemQueryService items,
    com.procurement.sourcing.infrastructure.QuotationMapper mapper) {
  public byte[] export(String rfqId) {
    var pack=service.read(rfqId,false);
    if(pack.sealed())throw new IllegalStateException("报价尚未解封，不能导出比价表");
    var latest=new LinkedHashMap<String,QuoteVersionService.VersionView>();
    var requirements=items.listItems(pack.policy().tenantId(),rfqId);
    pack.versions().stream().filter(v->v.round()==pack.round()).forEach(v->latest.put(v.quoteId(),v));
    try(var book=new XSSFWorkbook();var out=new ByteArrayOutputStream()){
      var summary=book.createSheet("报价汇总");row(summary,0,"项目编号","供应商名称","供应商编号","报价版本","含税报价总额","税率(%)","交期(天)","发票类型","备注","价格参考排序");
      var technical=book.createSheet("逐项技术比价");row(technical,0,"供应商名称","供应商编号","报价版本","清单行编号","采购品名","采购技术要求","单位","数量","含税单价","含税行金额","品牌","型号","实际技术参数","技术响应及偏离","行备注");
      var files=book.createSheet("报价附件台账");row(files,0,"文件编号","文件名","字节数","SHA256");
      var history=book.createSheet("报价版本记录");row(history,0,"供应商编号","报价编号","轮次","版本","提交人编号","提交时间","记录来源","含税总额");
      int i=1,t=1;
      var ranked=latest.values().stream().sorted(Comparator.comparing(v->v.snapshot().quote().amount())).toList();
      for(var version:ranked){
        var q=version.snapshot().quote();var d=version.snapshot().details();
        row(summary,i,rfqId,mapper.supplierName(q.supplierId()),q.supplierId(),version.versionNo(),q.amount(),q.taxRate(),q.deliveryDays(),d==null?"":d.invoiceType(),d==null?"":d.remark(),i++);
        for(var line:q.lineItems()){
          var response=d==null||d.lines()==null?null:d.lines().stream().filter(l->Objects.equals(l.demandItemId(),line.demandItemId())).findFirst().orElse(null);
          String requirement=requirements.stream().filter(item->Objects.equals(item.demandItemId(),line.demandItemId())).map(item->Objects.toString(item.specification(),"")).findFirst().orElse("");
          row(technical,t++,mapper.supplierName(q.supplierId()),q.supplierId(),version.versionNo(),line.demandItemId(),line.description(),requirement,line.unit(),line.quantity(),line.unitPrice(),line.lineAmount(),
              response==null?"":response.brand(),response==null?"":response.model(),response==null?"":response.technicalParameters(),response==null?"":response.technicalResponse(),response==null?"":response.remark());
        }
      }
      i=1;for(var file:pack.files())row(files,i++,file.id(),file.fileName(),file.contentSize(),file.sha256());
      i=1;for(var version:pack.versions())row(history,i++,version.snapshot().quote().supplierId(),version.quoteId(),version.round(),version.versionNo(),version.actorId(),version.createdAt(),version.source(),version.snapshot().quote().amount());
      for(var sheet:book){sheet.createFreezePane(0,1);sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0,Math.max(0,sheet.getLastRowNum()),0,sheet.getRow(0).getLastCellNum()-1));
        CellStyle wrap=book.createCellStyle();wrap.setWrapText(true);wrap.setVerticalAlignment(VerticalAlignment.TOP);
        CellStyle heading=book.createCellStyle();heading.cloneStyleFrom(wrap);var font=book.createFont();font.setBold(true);heading.setFont(font);
        for(var r:sheet){for(var cell:r)cell.setCellStyle(r.getRowNum()==0?heading:wrap);r.setHeightInPoints(r.getRowNum()==0?30:72);}
        for(int c=0;c<sheet.getRow(0).getLastCellNum();c++)sheet.setColumnWidth(c,(sheet==technical&&c>=10?55:24)*256);
      }
      book.write(out);return out.toByteArray();
    }catch(java.io.IOException e){throw new IllegalStateException("无法导出技术比价表",e);}
  }
  private static void row(Sheet sheet,int index,Object...values){var row=sheet.createRow(index);for(int i=0;i<values.length;i++){var c=row.createCell(i);if(values[i] instanceof Number n)c.setCellValue(n.doubleValue());else c.setCellValue(values[i]==null?"":values[i].toString());}}
}
