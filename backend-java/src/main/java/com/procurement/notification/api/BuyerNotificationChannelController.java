package com.procurement.notification.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.notification.application.NotificationChannelService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/notification-channels")
public class BuyerNotificationChannelController {
  private final NotificationChannelService notificationChannelService;

  public BuyerNotificationChannelController(
      NotificationChannelService notificationChannelService) {
    this.notificationChannelService = notificationChannelService;
  }

  @GetMapping("/settings")
  public ApiResponse<NotificationSettingsResponse> settings() {
    return ApiResponse.ok(notificationChannelService.currentSettings());
  }

  @PutMapping("/settings")
  public ApiResponse<NotificationSettingsResponse> updateSettings(
      @RequestBody UpdateNotificationSettingsRequest request) {
    return ApiResponse.ok(notificationChannelService.updateSettings(request));
  }

  @GetMapping("/deliveries")
  public ApiResponse<List<NotificationDeliveryResponse>> deliveries() {
    return ApiResponse.ok(notificationChannelService.deliveries());
  }

  @PostMapping("/test")
  public ApiResponse<List<NotificationDeliveryResponse>> test() {
    return ApiResponse.ok(notificationChannelService.dispatchTest());
  }

  /** 失败/未配置的投递重试(E-2)。 */
  @PostMapping("/deliveries/{deliveryId}/retry")
  public ApiResponse<List<NotificationDeliveryResponse>> retry(
      @org.springframework.web.bind.annotation.PathVariable String deliveryId) {
    return ApiResponse.ok(notificationChannelService.retryDelivery(deliveryId));
  }
}
