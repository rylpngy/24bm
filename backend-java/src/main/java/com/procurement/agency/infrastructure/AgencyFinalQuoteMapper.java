package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyFinalQuoteRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyFinalQuoteMapper {
  @Select(
      "select * from agency_final_quote_campaigns where tenant_id=#{t} and session_id=#{session}")
  Campaign campaign(String t, String session);

  @Select("select * from agency_final_quote_campaigns where tenant_id=#{t} and id=#{id}")
  Campaign find(String t, String id);

  @Select("select * from agency_final_quote_receipts where tenant_id=#{t} and file_id=#{file}")
  Receipt receiptFile(String t, String file);

  @Select(
      "select * from agency_final_quote_receipts where tenant_id=#{t} and campaign_id=#{id} order"
          + " by created_at desc,id")
  List<Receipt> receipts(String t, String id);

  @Insert(
      "insert into"
          + " agency_final_quote_campaigns(id,tenant_id,session_id,package_id,cutoff_at,initiated_at,subjects_json,scope_hash,exclusions_json,requirements_version_id,requirements_hash,notice_version_id,notice_hash,reason,created_by,discussion_manifest_json,discussion_fingerprint,requirement_changes_json)"
          + " values(#{a.id},#{a.tenantId},#{a.sessionId},#{a.packageId},#{a.cutoffAt},#{a.initiatedAt},cast(#{a.subjectsJson}"
          + " as jsonb),#{a.scopeHash},cast(#{a.exclusionsJson} as"
          + " jsonb),#{a.requirementsVersionId},#{a.requirementsHash},#{a.noticeVersionId},#{a.noticeHash},#{a.reason},#{a.createdBy},cast(#{a.discussionManifestJson}"
          + " as jsonb),#{a.discussionFingerprint},cast(#{a.requirementChangesJson} as jsonb))")
  void create(@Param("a") Campaign a);

  @Insert(
      "insert into"
          + " agency_final_quote_receipts(id,tenant_id,campaign_id,participation_id,file_id,amount,currency,received_at,original_type,source_note,late_entry_reason,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.campaignId},#{a.participationId},#{a.fileId},#{a.amount},#{a.currency},#{a.receivedAt},#{a.originalType},#{a.sourceNote},#{a.lateEntryReason},#{a.createdBy})")
  void receive(@Param("a") Receipt a);

  @Update(
      "update agency_final_quote_campaigns set version=version+1 where tenant_id=#{t} and id=#{id}"
          + " and status='collecting' and version=#{v}")
  int bump(String t, String id, long v);

  @Update(
      "update agency_final_quote_receipts set status='withdrawn',withdraw_reason=#{reason} where"
          + " tenant_id=#{t} and id=#{id} and status='received'")
  int withdraw(String t, String id, String reason);

  @Update(
      "update agency_final_quote_campaigns set"
          + " status='confirmed',version=version+1,confirmed_at=now(),confirmation_version_id=#{proof},confirmation_hash=#{hash},decisions_json=cast(#{results}"
          + " as jsonb),confirmation_note=#{note} where tenant_id=#{t} and id=#{id} and"
          + " version=#{v} and status='collecting'")
  int confirm(String t, String id, long v, String proof, String hash, String results, String note);
}
