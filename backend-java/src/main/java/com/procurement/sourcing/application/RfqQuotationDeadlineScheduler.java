package com.procurement.sourcing.application;

import com.procurement.sourcing.infrastructure.QuotationMapper;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@Component
@ConditionalOnProperty(name="app.rfq.quotation-extensions.enabled",havingValue="true")
public record RfqQuotationDeadlineScheduler(QuotationMapper mapper,RfqQuotationService service) {
  @Scheduled(fixedDelayString="${app.rfq.quotation-extensions.interval-ms:60000}") public void sweep(){
    for(var policy:mapper.expiredPolicies())try{service.autoExtend(policy);}catch(RuntimeException exception){
      org.slf4j.LoggerFactory.getLogger(RfqQuotationDeadlineScheduler.class).warn("RFQ extension deferred {}: {}",policy.rfqId(),exception.getClass().getSimpleName());
    }
  }
}
