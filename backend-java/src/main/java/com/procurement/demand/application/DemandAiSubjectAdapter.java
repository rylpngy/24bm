package com.procurement.demand.application;

import com.procurement.common.ai.*;
import com.procurement.common.ai.AiContracts.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class DemandAiSubjectAdapter implements AiSubjectAdapter {
  private final PurchaseDemandApplicationService demands;
  public DemandAiSubjectAdapter(PurchaseDemandApplicationService demands) { this.demands=demands; }
  public String subjectType() { return "demand"; }
  public void authorize(String id) { demands.getCurrentTenantDemand(id); }
  @org.springframework.transaction.annotation.Transactional(readOnly=true,
      isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ,
      propagation=org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
  public Snapshot capture(String id) {
    var demand=demands.getCurrentTenantDemand(id); String revision=AiSupport.revision(demand);
    List<Evidence> evidence=new ArrayList<>(); List<Finding> findings=new ArrayList<>(); List<String> limitations=new ArrayList<>();
    evidence.add(AiSupport.field("title","采购需求名称",demand.title(),id,revision));
    evidence.add(AiSupport.field("purpose","采购用途及业务目的",demand.purpose(),id,revision));
    evidence.add(AiSupport.field("budget","申报预算金额",demand.budget(),id,revision));
    var lines=demand.lineItems()==null?List.<com.procurement.demand.api.PurchaseDemandLineItemResponse>of():demand.lineItems();
    evidence.add(AiSupport.field("lineCount","采购需求明细条数",lines.size(),id,revision));
    if(demand.purpose()==null || demand.purpose().isBlank()) findings.add(AiSupport.finding("purpose-missing","warning","采购用途尚未填写","当前记录缺少业务用途，建议补充后由业务人员复核。","purpose"));
    if(demand.budget()==null || demand.budget().compareTo(BigDecimal.ZERO)<=0) findings.add(AiSupport.finding("budget-invalid","risk","预算金额缺失或非正数","当前字段不能证明申报预算为有效正数，请核对原始需求。","budget"));
    if(lines.isEmpty()) findings.add(AiSupport.finding("lines-missing","warning","尚无采购需求明细","当前没有可用于复核物料及数量的明细记录。","lineCount"));
    int index=0;
    for(var line:lines) {
      if(index>=80) { limitations.add("仅检查前80条需求明细，其余明细未评估，须另行人工复核。"); break; }
      String field="line:"+(index++)+":quantity";
      evidence.add(AiSupport.field(field,"物料 "+AiSupport.text(line.materialId())+" 的申报数量",line.quantity(),line.id()==null?id:line.id(),revision));
      if(line.quantity()==null || line.quantity().signum()<=0) findings.add(AiSupport.finding("quantity-"+index,"risk","物料数量缺失或非正数","所引明细没有有效正数数量，请核对需求记录。",field));
    }
    limitations.add("需求记录未提供明细单价证据，本次不作预算与价格一致性或市场价格合理性结论。");
    return new Snapshot(revision,evidence,findings,limitations,List.of());
  }
}
