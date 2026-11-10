package com.procurement.agency.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyRecords {
  private AgencyRecords() {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyGroup")
  public record Group(
      String id,
      String tenantId,
      String name,
      String tags,
      String createdBy,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyPackageRow")
  public record PackageRow(
      String id,
      String tenantId,
      String groupId,
      String title,
      String businessCategory,
      String objectCode,
      String procurementMethod,
      String regime,
      String region,
      String operatingMode,
      String departmentId,
      String ownerId,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal budget,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal ceiling,
      String currency,
      String status,
      String number,
      Integer businessYear,
      Integer serial,
      long version,
      String dataJson,
      String workflowId,
      String createdBy,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt,
      String businessStatus,
      String archiveCompletion,
      String financialStatus) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyMember")
  public record Member(String userId, String role) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyDraft")
  public record Draft(
      Long expectedVersion,
      String groupId,
      String title,
      String businessCategory,
      String objectCode,
      String procurementMethod,
      String regime,
      String region,
      String operatingMode,
      String departmentId,
      String ownerId,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal budget,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal ceiling,
      String currency,
      Map<String, String> purchaser,
      Map<String, String> entrustment,
      Map<String, String> feeAgreement,
      Map<String, String> supplement,
      List<Member> members) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyMemberRow")
  public record MemberRow(String userId, String role, String name) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyReview")
  public record Review(
      String id,
      String tenantId,
      String packageId,
      String kind,
      long baseVersion,
      String proposedJson,
      String snapshotJson,
      String status,
      String requestedBy,
      String workflowId,
      OffsetDateTime createdAt,
      String comment) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyHistory")
  public record History(
      long version, String dataJson, String reason, String actorId, OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyNumbering")
  public record Numbering(
      String tenantId,
      String pattern,
      String timeZone,
      String categories,
      String objects,
      long version) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyFileRow")
  public record FileRow(
      String id,
      String tenantId,
      String packageId,
      String name,
      String category,
      String visibility,
      String createdBy,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyFileVersion")
  public record FileVersion(
      String id,
      String tenantId,
      String fileId,
      int ordinal,
      String status,
      String attachmentId,
      String hash,
      Long contentSize,
      String createdBy,
      OffsetDateTime createdAt,
      String reason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyFileView")
  public record FileView(FileRow file, List<FileVersion> versions) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyDetail")
  public record Detail(
      PackageRow record,
      Draft data,
      List<MemberRow> members,
      List<Review> reviews,
      List<History> history,
      List<FileView> files,
      boolean canEdit,
      boolean canSubmit,
      boolean canWithdraw,
      boolean canManageFiles,
      String businessStatus,
      String archiveCompletion,
      String financialStatus) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyPage")
  public record Page(List<PackageRow> items, int total, int page, int pageSize) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyIdempotency")
  public record Idempotency(String fingerprint, String responseJson) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyPerson")
  public record Person(String id, String name, String departmentId) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyDepartment")
  public record Department(String id, String name) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOptions")
  public record Options(
      List<Person> users,
      List<Department> departments,
      Numbering numbering,
      List<String> procurementMethods) {}
}
