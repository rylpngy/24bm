package com.procurement.supplier.application;
import com.procurement.supplier.infrastructure.SupplierImportMapper;
import com.procurement.supplier.api.CreateBuyerSupplierRequest;
import com.procurement.common.excel.ExcelSheets;
import com.procurement.common.api.*;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class SupplierImportService {
  private static final List<String> HEADERS=List.of("公共供应商编号*","分级*","授权品类*(分号分隔)","联系人","联系电话","邮箱","经营范围");
  private final SupplierImportMapper mapper;private final BuyerSupplierApplicationService relations;private final PermissionService permissions;
  public SupplierImportService(SupplierImportMapper mapper,BuyerSupplierApplicationService relations,PermissionService permissions){this.mapper=mapper;this.relations=relations;this.permissions=permissions;}
  public byte[] template(){permissions.require("buyer:supplier:manage");return ExcelSheets.template("供应商关系导入",HEADERS,List.of());}
  public ImportResultResponse importFile(byte[] bytes){
    permissions.require("buyer:supplier:manage");String tenant=TenantAccessGuard.requireTenantId("supplier import");
    if(bytes==null||bytes.length==0||bytes.length>2*1024*1024)throw new IllegalArgumentException("请上传不超过2MB的xlsx文件");
    var rows=ExcelSheets.readFirstSheet(bytes,201);
    if(rows.size()<2||!rows.getFirst().equals(HEADERS))throw new IllegalArgumentException("请使用供应商关系导入模板，保留原表头并填写数据行");
    var failures=new ArrayList<ImportRowError>();var seen=new HashSet<String>();int success=0,total=0;
    for(int r=1;r<rows.size();r++){
      var row=rows.get(r);if(row.stream().allMatch(String::isBlank))continue;total++;
      try{
        if(row.size()>HEADERS.size()&&row.subList(HEADERS.size(),row.size()).stream().anyMatch(v->!v.isBlank()))throw new IllegalArgumentException("存在模板以外的字段");
        String id=cell(row,0),level=cell(row,1),category=cell(row,2),email=cell(row,5);
        if(id.isBlank()||level.isBlank()||category.isBlank())throw new IllegalArgumentException("公共供应商编号、分级、授权品类必填");
        if(row.stream().anyMatch(v->v.length()>1000)||id.length()>200||level.length()>50)throw new IllegalArgumentException("字段内容过长");
        if(!email.isBlank()&&!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))throw new IllegalArgumentException("邮箱格式不正确");
        if(!seen.add(id))throw new IllegalArgumentException("文件内供应商编号重复");
        if(!mapper.available(id))throw new IllegalArgumentException("公共供应商不存在或尚未认证，请先完成平台注册认证");
        if(mapper.linked(tenant,id))throw new IllegalArgumentException("供应商已在本企业库内，请使用资料维护，不重复导入");
        var categories=Arrays.stream(category.split("[;；]" )).map(String::strip).filter(v->!v.isEmpty()).distinct().toList();
        if(categories.isEmpty()||categories.size()>30)throw new IllegalArgumentException("请填写1至30个有效授权品类");
        relations.createSupplierRelation(new CreateBuyerSupplierRequest(id,"待准入",level,categories,null,null,
            blank(cell(row,3)),blank(cell(row,4)),blank(email),blank(cell(row,6)),null,null));success++;
      }catch(org.springframework.dao.DuplicateKeyException e){failures.add(new ImportRowError(r+1,"供应商关系已存在，请刷新后核对"));}
      catch(IllegalArgumentException e){failures.add(new ImportRowError(r+1,e.getMessage()));}
    }
    return new ImportResultResponse(total,success,failures);
  }
  private static String cell(List<String> row,int i){return i<row.size()?row.get(i).strip():"";}
  private static String blank(String s){return s.isBlank()?null:s;}
}
