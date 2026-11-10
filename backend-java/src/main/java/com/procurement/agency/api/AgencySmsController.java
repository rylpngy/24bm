package com.procurement.agency.api;

import com.procurement.agency.application.AgencySmsService;
import com.procurement.agency.domain.AgencySmsRecords.*;
import com.procurement.common.api.ApiResponse;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/packages/{pkg}/sms")
public record AgencySmsController(AgencySmsService service) {
  @GetMapping
  public ApiResponse<View> view(@PathVariable String pkg) {
    return ApiResponse.ok(service.view(pkg));
  }

  @PutMapping("/settings")
  public ApiResponse<Settings> config(@PathVariable String pkg, @RequestBody Config d) {
    return ApiResponse.ok(service.configure(pkg, d));
  }

  @PutMapping("/contacts/{user}")
  public ApiResponse<ContactView> contact(
      @PathVariable String pkg, @PathVariable String user, @RequestBody ContactInput d) {
    return ApiResponse.ok(service.contact(pkg, user, d));
  }

  @PostMapping
  public ApiResponse<Delivery> send(@PathVariable String pkg, @RequestBody Send d) {
    return ApiResponse.ok(service.send(pkg, d));
  }

  @GetMapping("/{id}/attempts")
  public ApiResponse<List<Attempt>> attempts(@PathVariable String pkg, @PathVariable String id) {
    return ApiResponse.ok(service.attempts(pkg, id));
  }

  public record Cancel(String reason) {}

  @PostMapping("/{id}/retry")
  public ApiResponse<Delivery> retry(
      @PathVariable String pkg, @PathVariable String id, @RequestBody Cancel d) {
    if (d == null) throw new IllegalArgumentException("缺少重试依据");
    return ApiResponse.ok(service.retry(pkg, id, d.reason()));
  }

  @PostMapping("/{id}/cancel")
  public ApiResponse<Delivery> cancel(
      @PathVariable String pkg, @PathVariable String id, @RequestBody Cancel d) {
    if (d == null) throw new IllegalArgumentException("缺少取消依据");
    return ApiResponse.ok(service.cancel(pkg, id, d.reason()));
  }
}
