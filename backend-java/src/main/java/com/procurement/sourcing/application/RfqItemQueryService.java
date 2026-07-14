package com.procurement.sourcing.application;

import com.procurement.catalog.application.MaterialApplicationService;
import com.procurement.catalog.domain.Material;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.demand.domain.PurchaseDemandItem;
import com.procurement.sourcing.api.RfqItemResponse;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * 采购清单装配:RFQ → 关联需求 → 物资明细 → 补物料主数据(名称/规格/单位)。
 * 买卖双方看到的是同一份清单;供应商按此逐行报价(数量由采购方给定,不可改)。
 * 商城锚点等无关联需求的项目返回空清单(无报价环节)。
 */
@Service
public class RfqItemQueryService {
  private final RfqDemandMapper rfqDemandMapper;
  private final PurchaseDemandApplicationService purchaseDemandApplicationService;
  private final MaterialApplicationService materialApplicationService;

  public RfqItemQueryService(
      RfqDemandMapper rfqDemandMapper,
      PurchaseDemandApplicationService purchaseDemandApplicationService,
      MaterialApplicationService materialApplicationService) {
    this.rfqDemandMapper = rfqDemandMapper;
    this.purchaseDemandApplicationService = purchaseDemandApplicationService;
    this.materialApplicationService = materialApplicationService;
  }

  public List<RfqItemResponse> listItems(String tenantId, String rfqId) {
    List<String> demandIds = rfqDemandMapper.listDemandIds(tenantId, rfqId);
    List<PurchaseDemandItem> items =
        purchaseDemandApplicationService.findItemsByTenantAndDemands(tenantId, demandIds);
    if (items.isEmpty()) {
      return List.of();
    }
    Map<String, Material> materials = materialApplicationService
        .findMaterialsByTenantAndIds(tenantId, items.stream().map(PurchaseDemandItem::materialId).toList())
        .stream()
        .collect(Collectors.toMap(Material::id, Function.identity(), (a, b) -> a));

    return items.stream()
        .map(item -> {
          Material material = materials.get(item.materialId());
          return new RfqItemResponse(
              item.id(),
              item.materialId(),
              material == null ? item.materialId() : material.name(),
              material == null ? null : material.specification(),
              material == null ? "项" : material.unit(),
              item.quantity());
        })
        .toList();
  }

  /** 清单行 → 数量映射,供报价行一致性校验(空清单=不施加清单规则)。 */
  public Map<String, BigDecimal> itemQuantities(String tenantId, String rfqId) {
    return listItems(tenantId, rfqId).stream()
        .collect(Collectors.toMap(RfqItemResponse::demandItemId, RfqItemResponse::quantity, (a, b) -> a));
  }
}
