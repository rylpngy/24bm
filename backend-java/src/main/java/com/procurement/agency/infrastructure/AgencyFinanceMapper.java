package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyFinanceRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyFinanceMapper {
  @Select(
      "select code,label,active,version from agency_finance_categories where tenant_id=#{t} order"
          + " by code")
  List<Category> categories(String t);

  @Insert(
      "insert into agency_finance_categories(tenant_id,code,label,active,updated_by)"
          + " values(#{t},#{code},#{label},#{active},#{actor})")
  void createCategory(String t, String code, String label, boolean active, String actor);

  @Update(
      "update agency_finance_categories set"
          + " label=#{label},active=#{active},version=version+1,updated_by=#{actor},updated_at=now()"
          + " where tenant_id=#{t} and code=#{code} and version=#{v}")
  int category(String t, String code, long v, String label, boolean active, String actor);

  @Select(
      "select * from agency_finance_accounts where tenant_id=#{t} and package_id=#{p} order by"
          + " created_at desc,id")
  List<Account> accounts(String t, String p);

  @Select("select * from agency_finance_accounts where tenant_id=#{t} and id=#{id}")
  Account account(String t, String id);

  @Insert(
      "insert into"
          + " agency_finance_accounts(id,tenant_id,package_id,kind,category,currency,budget,requested,snapshot_json,frozen_hash,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.packageId},#{a.kind},#{a.category},#{a.currency},#{a.budget},#{a.requested},cast(#{a.snapshotJson}"
          + " as jsonb),#{a.frozenHash},#{a.createdBy})")
  void createAccount(@Param("a") Account a);

  @Update(
      "update agency_finance_accounts set"
          + " status=#{after},version=version+1,workflow_id=#{wf},approved=#{amount} where"
          + " tenant_id=#{t} and id=#{id} and status=#{before} and version=#{v}")
  int state(
      String t,
      String id,
      long v,
      String before,
      String after,
      String wf,
      java.math.BigDecimal amount);

  @Select(
      "select * from agency_finance_entries where tenant_id=#{t} and package_id=#{p} order by"
          + " created_at desc,id")
  List<Entry> entries(String t, String p);

  @Select("select * from agency_finance_entries where tenant_id=#{t} and id=#{id}")
  Entry entry(String t, String id);

  @Insert(
      "insert into"
          + " agency_finance_entries(id,tenant_id,package_id,account_id,kind,amount,occurred_at,evidence_version_id,evidence_hash,snapshot_json,frozen_hash,status,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.packageId},#{a.accountId},#{a.kind},#{a.amount},#{a.occurredAt},#{a.evidenceVersionId},#{a.evidenceHash},cast(#{a.snapshotJson}"
          + " as jsonb),#{a.frozenHash},#{a.status},#{a.createdBy})")
  void createEntry(@Param("a") Entry a);

  @Update(
      "update agency_finance_entries set status=#{after},version=version+1,workflow_id=#{wf} where"
          + " tenant_id=#{t} and id=#{id} and status=#{before} and version=#{v}")
  int entryState(String t, String id, long v, String before, String after, String wf);

  @Update(
      "update agency_packages set financial_status='unsettled' where tenant_id=#{t} and id=#{p}")
  void reopen(String t, String p);
}
