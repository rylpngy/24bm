package com.procurement.buyer.application;

import com.procurement.buyer.api.ProjectContracts.*;
import com.procurement.buyer.infrastructure.ProcurementProjectMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.*;
import java.math.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public record ProjectPlanSupport(
    ProcurementProjectMapper mapper, PermissionService permissions, DataScopeService scopes) {
  public List<Line> validate(String tenant, Draft d) {
    permissions.require("buyer:material:read");
    scopes.requireRecordAccess(d.departmentId(), TenantAccessGuard.requireUserId("project"));
    return validateState(tenant, d);
  }

  public List<Line> validateState(String tenant, Draft d) {
    if (!mapper.validOwner(tenant, d.departmentId(), d.ownerId()))
      throw new IllegalArgumentException("请选择本企业有效部门和该部门在职负责人");
    var result = new ArrayList<Line>();
    var seen = new HashSet<String>();
    int index = 0;
    for (var l : d.lines()) {
      if (!seen.add(l.materialId())) throw new IllegalArgumentException("重复物料请合并数量");
      var material = mapper.material(tenant, l.materialId());
      if (material == null) throw new IllegalArgumentException("物料不属于当前企业");
      if (l.quantity().signum() <= 0
          || l.quantity().scale() > 4
          || l.unitPrice().signum() < 0
          || l.unitPrice().scale() > 4
          || l.quantity().precision() - l.quantity().scale() > 12
          || l.unitPrice().precision() - l.unitPrice().scale() > 12)
        throw new IllegalArgumentException("数量及单价最多4位小数、12位整数");
      result.add(
          new Line(
              String.format("%04d", ++index),
              l.materialId(),
              String.valueOf(material.get("name")),
              Objects.toString(material.get("specification"), ""),
              Objects.toString(material.get("unit"), ""),
              l.quantity(),
              l.unitPrice(),
              Objects.toString(l.purpose(), "")));
    }
    var total = total(result);
    if (total.signum() <= 0 || total.precision() - total.scale() > 14)
      throw new IllegalArgumentException("项目明细合计须大于0且不超过14位整数");
    return result;
  }

  public BigDecimal total(List<Line> lines) {
    return lines.stream()
        .map(l -> l.quantity().multiply(l.unitPrice()).setScale(2, RoundingMode.HALF_UP))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  public void save(String tenant, String project, List<Line> lines) {
    mapper.replaceLines(tenant, project);
    int i = 0;
    for (var l : lines)
      mapper.insertLine(
          tenant,
          project,
          new Line(
              project + "-" + String.format("%04d", ++i),
              l.materialId(),
              l.name(),
              l.specification(),
              l.unit(),
              l.quantity(),
              l.unitPrice(),
              l.purpose()));
  }
}
