package com.procurement.notification.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.notification.application.NotificationApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/notifications")
public class SupplierNotificationController {
  private final NotificationApplicationService notificationApplicationService;

  public SupplierNotificationController(NotificationApplicationService notificationApplicationService) {
    this.notificationApplicationService = notificationApplicationService;
  }

  @GetMapping
  public ApiResponse<List<NotificationResponse>> list(@RequestParam(defaultValue = "50") int limit) {
    return ApiResponse.ok(notificationApplicationService.listCurrentSupplierUserNotifications(limit));
  }

  @PostMapping("/{notificationId}/read")
  public ApiResponse<NotificationResponse> markRead(@PathVariable String notificationId) {
    return ApiResponse.ok(notificationApplicationService.markCurrentSupplierUserNotificationRead(notificationId));
  }
}
