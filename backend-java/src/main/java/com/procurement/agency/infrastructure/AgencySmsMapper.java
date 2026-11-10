package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencySmsRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencySmsMapper {
  @Select("select * from agency_sms_settings where tenant_id=#{t}")
  Settings settings(String t);

  @Insert(
      "insert into agency_sms_settings(tenant_id,enabled,daily_limit,reason,updated_by)"
          + " values(#{t},false,1,'尚未配置',#{actor}) on conflict do nothing")
  void init(String t, String actor);

  @Select("select * from agency_sms_settings where tenant_id=#{t} for update")
  Settings lockSettings(String t);

  @Update(
      "update agency_sms_settings set"
          + " enabled=#{d.enabled},daily_limit=#{d.dailyLimit},reason=#{d.reason},version=version+1,updated_by=#{actor},updated_at=now()"
          + " where tenant_id=#{t} and version=#{d.expectedVersion}")
  int settingsSave(String t, @Param("d") Config d, String actor);

  @Select("select * from agency_sms_contacts where tenant_id=#{t} and user_id=#{user}")
  Contact contact(String t, String user);

  @Select("select * from agency_sms_contacts where tenant_id=#{t} order by user_id")
  List<Contact> contacts(String t);

  @Insert(
      "insert into"
          + " agency_sms_contacts(tenant_id,user_id,phone_cipher,masked_phone,consented,version,verified_by,reason)"
          + " values(#{t},#{user},#{cipher},#{masked},#{consent},1,#{actor},#{reason}) on"
          + " conflict(tenant_id,user_id) do update set"
          + " phone_cipher=excluded.phone_cipher,masked_phone=excluded.masked_phone,consented=excluded.consented,version=agency_sms_contacts.version+1,verified_by=excluded.verified_by,reason=excluded.reason,updated_at=now()")
  void contactSave(
      String t,
      String user,
      String cipher,
      String masked,
      boolean consent,
      String actor,
      String reason);

  @Select(
      "select * from agency_sms_outbox where tenant_id=#{t} and package_id=#{pkg} order by"
          + " created_at desc limit 200")
  List<Delivery> list(String t, String pkg);

  @Select("select * from agency_sms_outbox where tenant_id=#{t} and id=#{id}")
  Delivery find(String t, String id);

  @Select("select * from agency_sms_outbox where tenant_id=#{t} and id=#{id} for update")
  Delivery lock(String t, String id);

  @Select("select * from agency_sms_outbox where tenant_id=#{t} and reminder_id=#{id}")
  Delivery byReminder(String t, String id);

  @Insert(
      "insert into"
          + " agency_sms_outbox(id,tenant_id,package_id,reminder_id,recipient_id,contact_version,status,created_by)"
          + " values(#{id},#{t},#{pkg},#{event},#{user},#{v},'queued',#{actor})")
  void queue(String id, String t, String pkg, String event, String user, long v, String actor);

  @Select("select distinct tenant_id from agency_sms_outbox where status in ('queued','sending')")
  List<String> tenants();

  @Select(
      "select * from agency_sms_outbox where tenant_id=#{t} and status='queued' order by created_at"
          + " limit 10")
  List<Delivery> queued(String t);

  @Update(
      "update agency_sms_outbox set"
          + " status='unknown',error_text='发送进程中断，结果未知，禁止盲目重发；等待回执或网关查询',updated_at=now() where"
          + " tenant_id=#{t} and status='sending' and updated_at<now()-interval '2 minutes'")
  int recover(String t);

  @Update(
      "update agency_sms_outbox set"
          + " status=#{status},provider_ref=#{ref},error_text=#{note},attempts=attempts+#{inc},updated_at=now()"
          + " where tenant_id=#{t} and id=#{id}")
  void state(String t, String id, String status, String ref, String note, int inc);

  @Insert(
      "insert into agency_sms_attempts(id,tenant_id,outbox_id,attempt,status,note)"
          + " values(#{id},#{t},#{outbox},#{attempt},#{status},#{note})")
  void attempt(String id, String t, String outbox, int attempt, String status, String note);

  @Select(
      "select id,outbox_id,attempt,status,note,created_at from agency_sms_attempts where"
          + " tenant_id=#{t} and outbox_id=#{id} order by created_at")
  List<Attempt> attempts(String t, String id);

  @Select(
      "insert into agency_sms_quota(tenant_id,quota_day,used) values(#{t},(now() at time zone"
          + " 'Asia/Shanghai')::date,1) on conflict(tenant_id,quota_day) do update set"
          + " used=agency_sms_quota.used+1 where agency_sms_quota.used<#{limit} returning used")
  Integer quota(String t, int limit);

  @Select(
      "select count(*) from agency_sms_receipts where tenant_id=#{t} and outbox_id=#{id} and"
          + " receipt_hash=#{hash}")
  int seen(String t, String id, String hash);

  @Insert(
      "insert into agency_sms_receipts(tenant_id,outbox_id,receipt_hash,status)"
          + " values(#{t},#{id},#{hash},#{status})")
  void receipt(String t, String id, String hash, String status);
}
