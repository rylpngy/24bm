package com.procurement.sourcing.application;

import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import org.springframework.stereotype.Service;

/**
 * 询比回链查询入口:供其他模块(如需求)读取需求最近关联的 RFQ,
 * 避免跨模块直接依赖 sourcing infrastructure。
 */
@Service
public class RfqDemandLinkQueryService {
  public record RfqDemandLink(String rfqId, String status) {}

  private final RfqDemandMapper rfqDemandMapper;
  private final RfqMapper rfqMapper;

  public RfqDemandLinkQueryService(RfqDemandMapper rfqDemandMapper, RfqMapper rfqMapper) {
    this.rfqDemandMapper = rfqDemandMapper;
    this.rfqMapper = rfqMapper;
  }

  // 供订单等模块读取 RFQ 的采购方式(询比/竞价/商城/单一来源),不暴露 infrastructure。
  public String findRfqMethod(String tenantId, String rfqId) {
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    return rfq == null ? null : rfq.method();
  }

  public RfqDemandLink findLatestLinkForDemand(String tenantId, String demandId) {
    String rfqId = rfqDemandMapper.findLatestRfqIdByDemand(tenantId, demandId);
    if (rfqId == null) {
      return null;
    }
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    return new RfqDemandLink(rfqId, rfq == null ? null : rfq.status());
  }
}
