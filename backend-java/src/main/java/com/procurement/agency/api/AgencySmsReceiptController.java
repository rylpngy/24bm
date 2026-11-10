package com.procurement.agency.api;

import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencySmsRecords.Receipt;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/sms-bridge/receipt")
public record AgencySmsReceiptController(
    AgencySmsService service,
    AgencySmsGateway gateway,
    com.fasterxml.jackson.databind.ObjectMapper json) {
  @PostMapping
  public Map<String, Boolean> receipt(HttpServletRequest request) throws Exception {
    byte[] bytes = request.getInputStream().readNBytes(16385);
    gateway.verify(
        request.getHeader("X-24BM-Timestamp"), request.getHeader("X-24BM-Signature"), bytes);
    Receipt r;
    try {
      r = json.readValue(bytes, Receipt.class);
    } catch (java.io.IOException e) {
      throw new IllegalArgumentException("短信回执正文无效");
    }
    String hash =
        HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
    service.receipt(r, hash);
    return Map.of("accepted", true);
  }
}
