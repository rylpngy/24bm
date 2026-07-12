package com.procurement.sourcing.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.sourcing.application.RfqAnnouncementService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 门户公开采购公告(采购/变更/定标/终止),匿名可读,仅公开安全字段。
@RestController
@RequestMapping("/api/v1/public/procurement-announcements")
public class PublicProcurementAnnouncementController {
  private final RfqAnnouncementService rfqAnnouncementService;

  public PublicProcurementAnnouncementController(RfqAnnouncementService rfqAnnouncementService) {
    this.rfqAnnouncementService = rfqAnnouncementService;
  }

  @GetMapping
  public ApiResponse<List<PublicProcurementAnnouncementResponse>> list() {
    return ApiResponse.ok(rfqAnnouncementService.listPublic());
  }

  @GetMapping("/{announcementId}")
  public ApiResponse<PublicProcurementAnnouncementResponse> get(@PathVariable String announcementId) {
    return ApiResponse.ok(rfqAnnouncementService.getPublic(announcementId));
  }
}
