package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyIncidentRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyIncidentMapper {
  @Select("select * from agency_evaluation_controls where tenant_id=#{t} and round_id=#{round}")
  Control control(String t, String round);

  @Insert(
      "insert into agency_evaluation_controls(tenant_id,round_id,package_id,updated_by)"
          + " values(#{t},#{round},#{pkg},#{actor}) on conflict do nothing")
  void ensure(String t, String round, String pkg, String actor);

  @Update(
      "update agency_evaluation_controls set"
          + " state=#{state},version=version+1,updated_by=#{actor},updated_at=now() where"
          + " tenant_id=#{t} and round_id=#{round} and version=#{v}")
  int state(String t, String round, long v, String state, String actor);

  @Select(
      "select * from agency_evaluation_incidents where tenant_id=#{t} and round_id=#{round} order"
          + " by created_at desc,id")
  List<Incident> incidents(String t, String round);

  @Select("select * from agency_evaluation_incidents where tenant_id=#{t} and id=#{id}")
  Incident incident(String t, String id);

  @Insert(
      "insert into"
          + " agency_evaluation_incidents(id,tenant_id,round_id,package_id,kind,title,occurred_at,responsible_id,responsible_name,impact_scope,description,evidence_version_id,evidence_hash,effect,restoration_conditions,created_by)"
          + " values(#{a.id},#{a.tenantId},#{a.roundId},#{a.packageId},#{a.kind},#{a.title},#{a.occurredAt},#{a.responsibleId},#{a.responsibleName},#{a.impactScope},#{a.description},#{a.evidenceVersionId},#{a.evidenceHash},#{a.effect},#{a.restorationConditions},#{a.createdBy})")
  void create(@Param("a") Incident a);

  @Update(
      "update agency_evaluation_incidents set"
          + " status='resolved',version=version+1,resolution_json=cast(#{json} as"
          + " jsonb),resolved_by=#{actor},resolved_at=now() where tenant_id=#{t} and id=#{id} and"
          + " version=#{v} and status='open'")
  int resolve(String t, String id, long v, String json, String actor);

  @Insert(
      "insert into"
          + " agency_evaluation_control_events(id,tenant_id,round_id,control_version,action,before_state,after_state,incident_id,cases_fingerprint,evidence_version_id,evidence_hash,reason,actor_id)"
          + " values(#{a.id},#{a.tenantId},#{a.roundId},#{a.controlVersion},#{a.action},#{a.beforeState},#{a.afterState},#{a.incidentId},#{a.casesFingerprint},#{a.evidenceVersionId},#{a.evidenceHash},#{a.reason},#{a.actorId})")
  void event(@Param("a") Event a);

  @Select(
      "select * from agency_evaluation_control_events where tenant_id=#{t} and round_id=#{round}"
          + " order by control_version desc")
  List<Event> events(String t, String round);
}
