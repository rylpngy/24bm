package com.procurement.contract.application;

import com.procurement.contract.infrastructure.ContractMapper;
import org.springframework.stereotype.Service;

@Service
public record ContractSettlementService(ContractMapper mapper) {
  public void archive(String tenant, String contract, String settlement) {
    if (mapper.archiveSettlement(tenant, contract, settlement) != 1)
      throw new IllegalStateException("合同清算归档未生效");
  }
}
