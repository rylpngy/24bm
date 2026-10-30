package com.procurement;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.sourcing.application.QuoteVersionService;
import com.procurement.sourcing.infrastructure.QuotationMapper;
import com.procurement.sourcing.api.*;
import com.procurement.sourcing.domain.Rfq;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class QuoteVersionServiceTests {
  final QuotationMapper mapper=mock(QuotationMapper.class);
  final QuoteVersionService service=new QuoteVersionService(mapper,new ObjectMapper().findAndRegisterModules());
  final Rfq rfq=new Rfq("r","t","项目","报价中",OffsetDateTime.now().plusDays(1),"owner",null,null,null,null,null,null,null,1,false,"询比",
      null,null,null,null,null,null,null,null,null,null,null,null);
  final List<QuoteLineItemRequest> lines=List.of(new QuoteLineItemRequest("设备","台",BigDecimal.ONE,BigDecimal.TEN,"item"));
  QuotationDetails complete(String file){return new QuotationDetails("增值税普通发票","备注",List.of(file),List.of(new QuotationDetails.TechnicalLine("item","品牌","型号","参数","无偏离","")));}
  void setup(){when(mapper.policy("t","r")).thenReturn(new QuotationMapper.Policy("t","r",true,true,24,1));
    when(mapper.file("file")).thenReturn(new QuotationMapper.FileRow("file","t","r","s","原件","key",1,"sha","u",OffsetDateTime.now()));}
  @Test void acceptsZeroTaxAndCompleteTechnicalLine(){setup();assertThat(service.validate(rfq,"s",complete("file"),BigDecimal.ZERO,10,lines)).isTrue();}
  @Test void rejectsForeignSupplierFiles(){setup();assertThatThrownBy(()->service.validate(rfq,"another",complete("file"),BigDecimal.ZERO,10,lines)).hasMessageContaining("不属于");}
  @Test void rejectsDuplicateOrCrossItemTechnicalRows(){setup();var d=new QuotationDetails("增值税普通发票","",List.of("file"),List.of(new QuotationDetails.TechnicalLine("other","品牌","型号","参数","满足","")));
    assertThatThrownBy(()->service.validate(rfq,"s",d,BigDecimal.ZERO,10,lines)).hasMessageContaining("逐行对应");}
  @Test void completeModeDoesNotAcceptMissingDetails(){setup();assertThatThrownBy(()->service.validate(rfq,"s",null,BigDecimal.ZERO,10,lines)).hasMessageContaining("完整报价");}
  @Test void legacyModeDoesNotInventTechnicalCompleteness(){assertThat(service.validate(rfq,"s",null,BigDecimal.ZERO,10,lines)).isFalse();}
}
