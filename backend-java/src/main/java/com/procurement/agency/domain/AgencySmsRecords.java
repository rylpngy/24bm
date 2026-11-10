package com.procurement.agency.domain;

import java.time.*;
import java.util.*;

public final class AgencySmsRecords {
  public record Settings(
      String tenantId,
      boolean enabled,
      int dailyLimit,
      long version,
      String reason,
      String updatedBy,
      OffsetDateTime updatedAt) {}

  public record Contact(
      String tenantId,
      String userId,
      String phoneCipher,
      String maskedPhone,
      boolean consented,
      long version,
      String verifiedBy,
      String reason,
      OffsetDateTime updatedAt) {}

  public record ContactView(
      String userId,
      String maskedPhone,
      boolean consented,
      long version,
      OffsetDateTime updatedAt) {}

  public record Delivery(
      String id,
      String tenantId,
      String packageId,
      String reminderId,
      String recipientId,
      long contactVersion,
      String status,
      String providerRef,
      int attempts,
      String errorText,
      String createdBy,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt) {}

  public record Attempt(
      String id,
      String outboxId,
      int attempt,
      String status,
      String note,
      OffsetDateTime createdAt) {}

  public record View(
      boolean configured,
      Settings settings,
      List<ContactView> contacts,
      List<Delivery> deliveries) {}

  public record Config(Long expectedVersion, boolean enabled, int dailyLimit, String reason) {}

  public record ContactInput(
      Long expectedVersion, String phone, boolean consented, boolean verified, String reason) {}

  public record Send(String reminderId, boolean authorized, String reason) {}

  public record Receipt(String tenantId, String deliveryId, String providerRef, String status) {}
}
