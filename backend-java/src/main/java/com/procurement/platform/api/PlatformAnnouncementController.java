package com.procurement.platform.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.platform.application.PlatformAnnouncementApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/announcements")
public class PlatformAnnouncementController {
  private final PlatformAnnouncementApplicationService platformAnnouncementApplicationService;

  public PlatformAnnouncementController(
      PlatformAnnouncementApplicationService platformAnnouncementApplicationService) {
    this.platformAnnouncementApplicationService = platformAnnouncementApplicationService;
  }

  @GetMapping
  public ApiResponse<List<PlatformAnnouncementResponse>> list() {
    return ApiResponse.ok(platformAnnouncementApplicationService.listActive());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<PlatformAnnouncementResponse> publish(
      @Valid @RequestBody CreatePlatformAnnouncementRequest request) {
    return ApiResponse.ok(platformAnnouncementApplicationService.publish(request));
  }
}
