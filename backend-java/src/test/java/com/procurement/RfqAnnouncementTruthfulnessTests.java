package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.procurement.sourcing.application.RfqAnnouncementService;
import com.procurement.sourcing.infrastructure.PublicProcurementAnnouncementMapper;
import com.procurement.sourcing.infrastructure.RfqAnnouncementMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class RfqAnnouncementTruthfulnessTests {
  @Test
  void tenderAwardAnnouncementReportsPlatformNoticeNotUnprovenElectronicSigningOrDelivery() {
    var mapper = mock(RfqAnnouncementMapper.class);
    var service = new RfqAnnouncementService(mapper, mock(PublicProcurementAnnouncementMapper.class), null, null);
    service.onTenderAwarded("t", "tender", "采购项目", "公开招标", "供应商", BigDecimal.TEN);
    var summary = ArgumentCaptor.forClass(String.class);
    verify(mapper).insert(anyString(), eq("t"), eq("tender"), eq("定标公告"), anyString(), summary.capture(),
        eq("公开招标"), isNull(), isNull(), isNull(), isNull(), eq("供应商"), eq(BigDecimal.TEN), isNull());
    assertThat(summary.getValue()).contains("本平台发布定标结果通知", "供应商", "10")
        .doesNotContain("电子签章", "CA", "送达");
  }
}
