package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyRecords.PackageRow;
import com.procurement.agency.infrastructure.AgencyExecutionMapper;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class AgencyPlanInitializer {
  private final AgencyExecutionMapper mapper;
  private final AgencyJson json;

  public AgencyPlanInitializer(AgencyExecutionMapper mapper, AgencyJson json) {
    this.mapper = mapper;
    this.json = json;
  }

  public void ensure(PackageRow p) {
    if (!"approved".equals(p.status()) || !mapper.milestones(p.tenantId(), p.id()).isEmpty())
      return;
    var configured = mapper.planTemplate(p.tenantId(), p.procurementMethod());
    if (configured != null) {
      var nodes =
          java.util.Arrays.asList(
              json.read(
                  configured.nodesJson(),
                  com.procurement.agency.domain.AgencyExecutionRecords.PlanNode[].class));
      for (var node : nodes) {
        String id = id(p, node.key());
        mapper.milestoneCreate(
            p.tenantId(),
            id,
            p.id(),
            node.key(),
            node.title(),
            p.ownerId() == null ? p.createdBy() : p.ownerId(),
            json.write(node.dependencies().stream().map(key -> id(p, key)).toList()),
            node.materialRequirement(),
            configured.version());
        mapper.seedReminderPolicy(
            p.tenantId(),
            p.id(),
            id,
            json.write(
                com.procurement.agency.domain.AgencyReminderRules.normalize(node.reminders())),
            "继承公司计划模板V" + configured.version(),
            p.createdBy());
      }
      return;
    }
    String previous = null;
    for (String key :
        List.of(
            "demand",
            "document",
            "publication",
            "acquisition",
            "preparation",
            "evaluation",
            "result",
            "notice",
            "fees",
            "archive")) {
      if (("publication".equals(key) || "acquisition".equals(key))
          && "单一来源".equals(p.procurementMethod())) continue;
      String title =
          switch (key) {
            case "demand" -> "需求资料与确认";
            case "document" -> "采购文件及公告审批";
            case "publication" -> "外部人工发布登记";
            case "acquisition" -> "文件获取情况记录";
            case "preparation" -> "会前人员材料与场地准备";
            case "evaluation" -> "现场评审";
            case "result" -> "结果确认与办理";
            case "notice" -> "通知书办理";
            case "fees" -> "费用核对与跟进";
            default -> "档案补齐与归档";
          };
      String id =
          "agency-plan-"
              + java.util.UUID.nameUUIDFromBytes(
                  (p.tenantId() + ":" + p.id() + ":" + key)
                      .getBytes(java.nio.charset.StandardCharsets.UTF_8));
      mapper.milestoneCreate(
          p.tenantId(),
          id,
          p.id(),
          key,
          title,
          p.ownerId() == null ? p.createdBy() : p.ownerId(),
          json.write(previous == null ? List.of() : List.of(previous)),
          "以实际业务结果及适用凭证确认",
          0);
      if (!"fees".equals(key)) previous = id;
    }
  }

  private String id(PackageRow p, String key) {
    return "agency-plan-"
        + java.util.UUID.nameUUIDFromBytes(
            (p.tenantId() + ":" + p.id() + ":" + key)
                .getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }
}
