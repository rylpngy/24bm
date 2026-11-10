package com.procurement.agency.api;

import com.procurement.agency.application.AgencyOfficeEditService;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/office-bridge/{tenant}/{id}")
public record AgencyOfficeBridgeController(
    AgencyOfficeEditService service, com.fasterxml.jackson.databind.ObjectMapper json) {
  @GetMapping("/source")
  public ResponseEntity<byte[]> source(
      @PathVariable String tenant, @PathVariable String id, @RequestParam String ticket) {
    return ResponseEntity.ok()
        .contentType(
            MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .body(service.source(tenant, id, ticket));
  }

  @PostMapping("/callback")
  public Map<String, Integer> callback(
      @PathVariable String tenant,
      @PathVariable String id,
      jakarta.servlet.http.HttpServletRequest request,
      @RequestHeader(value = "Authorization", required = false) String auth) {
    try {
      byte[] bytes = request.getInputStream().readNBytes(65537);
      if (bytes.length > 65536) throw new IllegalArgumentException("Office回调正文超过64KB");
      var body = json.readTree(bytes);
      if (body == null || !body.isObject()) throw new IllegalArgumentException("Office回调正文须为对象");
      return service.callback(tenant, id, body, auth);
    } catch (java.io.IOException e) {
      throw new IllegalArgumentException("Office回调正文无效");
    }
  }
}
