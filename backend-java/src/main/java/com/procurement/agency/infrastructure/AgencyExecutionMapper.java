package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyExecutionMapper {
  @Select(
      "select * from agency_plan_templates where tenant_id=#{t} and procurement_method=#{method}"
          + " and operating_mode='half' order by version desc limit 1")
  PlanTemplate planTemplate(String t, String method);

  @Insert(
      "insert into"
          + " agency_plan_templates(tenant_id,procurement_method,version,nodes_json,reason,created_by)"
          + " values(#{t},#{method},#{version},cast(#{nodes} as jsonb),#{reason},#{actor})")
  void planTemplateCreate(
      String t, String method, long version, String nodes, String reason, String actor);

  @Select(
      """
<script>select r.* from agency_document_revisions r join agency_documents d on d.tenant_id=r.tenant_id and d.id=r.document_id join agency_packages p on p.tenant_id=d.tenant_id and p.id=d.package_id
where r.tenant_id=#{t} and r.status='approved' and d.kind='purchase' and (#{method}='' or p.procurement_method=#{method}) and (#{keyword}='' or p.title ilike '%'||#{keyword}||'%')
and (#{all} or p.created_by=#{actor} or p.owner_id=#{actor} or exists(select 1 from agency_members m where m.tenant_id=p.tenant_id and m.package_id=p.id and m.user_id=#{actor} and m.active)
<if test="departments != null and !departments.isEmpty()">or p.department_id in <foreach collection="departments" item="dep" open="(" close=")" separator=",">#{dep}</foreach></if>)
order by r.created_at desc limit 50</script>
""")
  List<Revision> historical(
      String t, String actor, boolean all, List<String> departments, String method, String keyword);

  @Insert(
      """
insert into agency_templates(id,tenant_id,package_id,name,scope,procurement_method,object_code,regime,region,description,created_by) values(#{id},#{t},#{d.packageId},#{d.name},#{d.scope},#{d.procurementMethod},#{d.objectCode},#{d.regime},#{d.region},coalesce(#{d.description},''),#{actor})
""")
  void createTemplate(String t, String id, TemplateDraft d, String actor);

  @Select(
      """
select * from agency_templates where tenant_id=#{t} and id=#{id}
""")
  Template template(String t, String id);

  @Select(
      """
select * from agency_templates where tenant_id=#{t} and id=#{id} for update
""")
  Template lockTemplate(String t, String id);

  @Select(
      """
select * from agency_templates where tenant_id=#{t} and (#{method}='' or procurement_method=#{method}) and (#{keyword}='' or name ilike '%'||#{keyword}||'%') order by created_at desc limit 200
""")
  List<Template> templates(String t, String method, String keyword);

  @Insert(
      """
insert into agency_template_versions(id,tenant_id,template_id,ordinal,sections_json,source_note,created_by,source_date,policy_version,origin_template_version_id) values(#{id},#{t},#{template},#{ordinal},cast(#{sections} as jsonb),#{note},#{actor},#{sourceDate},#{policyVersion},#{origin})
""")
  void templateVersion(
      String t,
      String id,
      String template,
      int ordinal,
      String sections,
      String note,
      String actor,
      java.time.LocalDate sourceDate,
      String policyVersion,
      String origin);

  @Select(
      """
select * from agency_template_versions where tenant_id=#{t} and template_id=#{id} order by ordinal desc
""")
  List<TemplateVersion> templateVersions(String t, String id);

  @Select(
      """
select * from agency_template_versions where tenant_id=#{t} and id=#{id}
""")
  TemplateVersion templateVersionById(String t, String id);

  @Update(
      """
update agency_templates set latest_ordinal=latest_ordinal+1,version=version+1 where tenant_id=#{t} and id=#{id} and version=#{v}
""")
  int nextTemplate(String t, String id, long v);

  @Update(
      """
update agency_templates set active=#{active},version=version+1 where tenant_id=#{t} and id=#{id} and version=#{v}
""")
  int templateActive(String t, String id, long v, boolean active);

  @Update(
      """
update agency_template_versions set status=#{status},workflow_id=#{workflow},requested_by=#{actor},comment=#{comment} where tenant_id=#{t} and id=#{id} and status=#{expected}
""")
  int templateState(
      String t,
      String id,
      String expected,
      String status,
      String workflow,
      String actor,
      String comment);

  @Update(
      """
update agency_templates set published_version_id=#{version},version=version+1 where tenant_id=#{t} and id=#{id}
""")
  void publishTemplate(String t, String id, String version);

  @Select(
      """
select * from agency_demand_items where tenant_id=#{t} and package_id=#{id} order by created_at,id
""")
  List<DemandItem> demands(String t, String id);

  @Select(
      """
select * from agency_demand_items where tenant_id=#{t} and id=#{id}
""")
  DemandItem demand(String t, String id);

  @Insert(
      """
insert into agency_demand_items(id,tenant_id,package_id,field_key,value_text,source_version_id,locator,status,origin,job_id,created_by,updated_by) values(#{id},#{t},#{pkg},#{d.fieldKey},#{d.valueText},#{d.sourceVersionId},#{d.locator},#{d.status},#{origin},#{job},#{actor},#{actor})
""")
  void demandCreate(
      String t, String id, String pkg, DemandDraft d, String origin, String job, String actor);

  @Update(
      """
update agency_demand_items set field_key=#{d.fieldKey},value_text=#{d.valueText},source_version_id=#{d.sourceVersionId},locator=#{d.locator},status=#{d.status},version=version+1,updated_by=#{actor},updated_at=now() where tenant_id=#{t} and id=#{id} and version=#{v}
""")
  int demandUpdate(String t, String id, long v, DemandDraft d, String actor);

  @Select(
      """
select * from agency_documents where tenant_id=#{t} and package_id=#{id} order by kind
""")
  List<Document> documents(String t, String id);

  @Select(
      """
select * from agency_documents where tenant_id=#{t} and id=#{id}
""")
  Document document(String t, String id);

  @Select(
      """
select * from agency_documents where tenant_id=#{t} and id=#{id} for update
""")
  Document lockDocument(String t, String id);

  @Insert(
      """
insert into agency_documents(id,tenant_id,package_id,kind,created_by) values(#{id},#{t},#{pkg},#{kind},#{actor}) on conflict(tenant_id,package_id,kind) do nothing
""")
  void ensureDocument(String t, String id, String pkg, String kind, String actor);

  @Update(
      """
update agency_documents set template_version_id=#{template},sections_json=cast(#{sections} as jsonb),settings_json=cast(#{settings} as jsonb),basis_json=cast(#{basis} as jsonb),version=version+1,status='draft',current_revision_id=null,updated_at=now() where tenant_id=#{t} and id=#{id} and version=#{v}
""")
  int documentEdit(
      String t, String id, long v, String template, String sections, String settings, String basis);

  @Update(
      """
update agency_documents set status=#{status},current_revision_id=#{revision},updated_at=now() where tenant_id=#{t} and id=#{id} and version=#{v}
""")
  int documentState(String t, String id, long v, String status, String revision);

  @Select(
      """
select * from agency_document_revisions where tenant_id=#{t} and document_id=#{id} order by created_at desc,id
""")
  List<Revision> revisions(String t, String id);

  @Select(
      """
select * from agency_document_revisions where tenant_id=#{t} and id=#{id}
""")
  Revision revision(String t, String id);

  @Insert(
      """
insert into agency_document_revisions(id,tenant_id,document_id,input_version,source_kind,file_version_id,hash,snapshot_json,job_id,created_by) values(#{id},#{t},#{doc},#{v},#{source},#{file},#{hash},cast(#{snapshot} as jsonb),#{job},#{actor})
""")
  void revisionCreate(
      String t,
      String id,
      String doc,
      long v,
      String source,
      String file,
      String hash,
      String snapshot,
      String job,
      String actor);

  @Update(
      """
update agency_document_revisions set status=#{status},workflow_id=#{workflow},requested_by=#{actor},comment=#{comment} where tenant_id=#{t} and id=#{id} and status=#{expected}
""")
  int revisionState(
      String t,
      String id,
      String expected,
      String status,
      String workflow,
      String actor,
      String comment);

  @Select(
      """
select distinct tenant_id from agency_execution_jobs
""")
  List<String> jobTenants();

  @Select(
      """
select * from agency_execution_jobs where tenant_id=#{t} and status='queued' and attempts<3 order by created_at limit 3
""")
  List<Job> queuedJobs(String t);

  @Update(
      """
update agency_execution_jobs set status='processing',attempts=attempts+1,started_at=now(),error_text=null where tenant_id=#{t} and id=#{id} and status='queued' and attempts<3
""")
  int claimJob(String t, String id);

  @Update(
      """
update agency_execution_jobs set status=case when attempts<3 then 'queued' else 'failed' end,error_text='任务执行中断，可重试',finished_at=now() where tenant_id=#{t} and status='processing' and started_at<now()-interval '5 minutes'
""")
  void recoverJobs(String t);

  @Insert(
      """
insert into agency_execution_jobs(id,tenant_id,package_id,kind,document_id,input_version,payload_json,created_by) values(#{id},#{t},#{pkg},#{kind},#{doc},#{v},cast(#{payload} as jsonb),#{actor})
""")
  void enqueue(
      String t,
      String id,
      String pkg,
      String kind,
      String doc,
      Long v,
      String payload,
      String actor);

  @Select(
      """
select * from agency_execution_jobs where tenant_id=#{t} and id=#{id}
""")
  Job job(String t, String id);

  @Select(
      """
select * from agency_execution_jobs where tenant_id=#{t} and package_id=#{id} order by created_at desc limit 30
""")
  List<Job> jobs(String t, String id);

  @Update(
      """
update agency_execution_jobs set status=#{status},result_json=cast(#{result} as jsonb),error_text=#{error},finished_at=now() where tenant_id=#{t} and id=#{id} and status='processing'
""")
  int finishJob(String t, String id, String status, String result, String error);

  @Update(
      """
update agency_execution_jobs set status='queued',attempts=0,error_text=null where tenant_id=#{t} and id=#{id} and status='failed'
""")
  int retryJob(String t, String id);

  @Select(
      """
select * from agency_publication_rules where tenant_id=#{t} and package_id=#{id}
""")
  PublicationRule rule(String t, String id);

  @Insert(
      """
insert into agency_publication_rules(tenant_id,package_id,announcement_applicable,reason,evidence_version_id,updated_by) values(#{t},#{id},#{applicable},#{reason},#{evidence},#{actor}) on conflict(tenant_id,package_id) do update set announcement_applicable=#{applicable},reason=#{reason},evidence_version_id=#{evidence},updated_by=#{actor},updated_at=now(),version=agency_publication_rules.version+1 where agency_publication_rules.tenant_id=#{t}
""")
  void saveRule(
      String t, String id, boolean applicable, String reason, String evidence, String actor);

  @Select(
      """
select * from agency_publications where tenant_id=#{t} and package_id=#{id} order by created_at desc
""")
  List<Publication> publications(String t, String id);

  @Insert(
      """
insert into agency_publications(id,tenant_id,package_id,purchase_revision_id,announcement_revision_id,platform,published_at,url,evidence_version_id,rule_version,created_by) values(#{id},#{t},#{pkg},#{purchase},#{announcement},#{platform},#{time},#{url},#{evidence},#{ruleVersion},#{actor})
""")
  void publication(
      String t,
      String id,
      String pkg,
      String purchase,
      String announcement,
      String platform,
      java.time.OffsetDateTime time,
      String url,
      String evidence,
      Long ruleVersion,
      String actor);

  @Update(
      """
update agency_packages set business_status=#{status} where tenant_id=#{t} and id=#{id}
""")
  void businessStatus(String t, String id, String status);

  @Select(
      """
select * from agency_participations where tenant_id=#{t} and package_id=#{id} order by created_at desc
""")
  List<Participation> participations(String t, String id);

  @Select(
      """
select * from agency_participations where tenant_id=#{t} and id=#{id}
""")
  Participation participation(String t, String id);

  @Insert(
      """
insert into agency_participations(id,tenant_id,package_id,supplier_name,credit_code,contact,phone,source,acquisition_status,submission_status,risk_note,risk_status,evidence_version_id,notes,created_by) values(#{id},#{t},#{pkg},#{d.supplierName},#{d.creditCode},#{d.contact},#{d.phone},#{d.source},#{d.acquisitionStatus},#{d.submissionStatus},#{d.riskNote},#{d.riskStatus},#{d.evidenceVersionId},#{d.notes},#{actor})
""")
  void participationCreate(String t, String id, String pkg, ParticipationDraft d, String actor);

  @Update(
      """
update agency_participations set supplier_name=#{d.supplierName},credit_code=#{d.creditCode},contact=#{d.contact},phone=#{d.phone},source=#{d.source},acquisition_status=#{d.acquisitionStatus},submission_status=#{d.submissionStatus},risk_note=#{d.riskNote},risk_status=#{d.riskStatus},evidence_version_id=#{d.evidenceVersionId},notes=#{d.notes},version=version+1,updated_at=now() where tenant_id=#{t} and id=#{id} and version=#{v}
""")
  int participationUpdate(String t, String id, long v, ParticipationDraft d);

  @Select(
      """
select * from agency_milestones where tenant_id=#{t} and package_id=#{id} order by created_at,node_key
""")
  List<Milestone> milestones(String t, String id);

  @Select(
      """
select * from agency_milestones where tenant_id=#{t} and id=#{id}
""")
  Milestone milestone(String t, String id);

  @Insert(
      """
insert into agency_milestones(id,tenant_id,package_id,node_key,title,owner_id,dependencies_json,material_requirement,template_version) values(#{id},#{t},#{pkg},#{key},#{title},#{owner},cast(#{dependencies} as jsonb),#{material},#{templateVersion}) on conflict(tenant_id,package_id,node_key) do nothing
""")
  void milestoneCreate(
      String t,
      String id,
      String pkg,
      String key,
      String title,
      String owner,
      String dependencies,
      String material,
      long templateVersion);

  @Update(
      """
update agency_milestones set title=#{d.title},owner_id=#{d.ownerId},starts_at=#{d.startsAt},due_at=#{d.dueAt},dependencies_json=cast(#{dependencies} as jsonb),material_requirement=#{d.materialRequirement},status=#{d.status},completed_at=case when #{d.status}='completed' then coalesce(completed_at,now()) else null end,result_note=#{d.resultNote},change_reason=#{d.reason},legal_deadline=#{d.legalDeadline},legal_basis=#{d.legalBasis},version=version+1,updated_at=now() where tenant_id=#{t} and id=#{id} and version=#{v}
""")
  int milestoneUpdate(String t, String id, long v, MilestoneDraft d, String dependencies);

  @Select(
      """
select distinct tenant_id from agency_milestones
""")
  List<String> planTenants();

  @Select(
      """
select m.* from agency_milestones m join agency_packages p on p.tenant_id=m.tenant_id and p.id=m.package_id where m.tenant_id=#{t} and p.status='approved' and p.workflow_id is null and m.status in ('planned','doing') and (m.due_at<=now()+interval '24 hours' or m.legal_deadline<=now()+interval '24 hours') order by m.due_at limit 100
""")
  List<Milestone> dueMilestones(String t);

  @Select(
      """
select * from agency_preparations where tenant_id=#{t} and package_id=#{id}
""")
  Preparation preparation(String t, String id);

  @Insert(
      """
insert into agency_preparations(tenant_id,package_id,venue,scheduled_at,material_notes,committee_notes,draw_notes,evidence_version_id,updated_by,scheduled_end_at,purpose) values(#{t},#{id},#{d.venue},#{d.scheduledAt},#{d.materialNotes},#{d.committeeNotes},#{d.drawNotes},#{d.evidenceVersionId},#{actor},#{d.scheduledEndAt},#{d.purpose}) on conflict(tenant_id,package_id) do update set venue=#{d.venue},scheduled_at=#{d.scheduledAt},scheduled_end_at=#{d.scheduledEndAt},purpose=#{d.purpose},material_notes=#{d.materialNotes},committee_notes=#{d.committeeNotes},draw_notes=#{d.drawNotes},evidence_version_id=#{d.evidenceVersionId},updated_by=#{actor},updated_at=now(),version=agency_preparations.version+1 where agency_preparations.tenant_id=#{t}
""")
  void preparationSave(String t, String id, PreparationDraft d, String actor);

  @Insert(
      """
insert into agency_execution_events(id,tenant_id,package_id,object_type,object_id,before_json,after_json,reason,actor_id) values(#{id},#{t},#{pkg},#{type},#{object},cast(#{before} as jsonb),cast(#{after} as jsonb),#{reason},#{actor})
""")
  void event(
      String t,
      String id,
      String pkg,
      String type,
      String object,
      String before,
      String after,
      String reason,
      String actor);

  @Insert(
      "insert into"
          + " agency_document_review_contexts(tenant_id,workflow_id,revision_id,waived_issues_json,exception_reason,created_by)"
          + " values(#{tenant},#{workflow},#{revision},#{issues},#{reason},#{actor})")
  void reviewContext(
      String tenant, String workflow, String revision, String issues, String reason, String actor);

  @Select(
      "select waived_issues_json from agency_document_review_contexts where tenant_id=#{tenant} and"
          + " workflow_id=#{workflow} and revision_id=#{revision}")
  String waivedIssues(String tenant, String workflow, String revision);

  @Select(
      "select count(*) from agency_preparations where tenant_id=#{tenant} and package_id<>#{pkg}"
          + " and lower(trim(venue))=lower(trim(#{venue})) and scheduled_at<#{end} and"
          + " coalesce(scheduled_end_at,scheduled_at+interval '1 hour')>#{start}")
  int venueConflicts(
      String tenant,
      String pkg,
      String venue,
      java.time.OffsetDateTime start,
      java.time.OffsetDateTime end);

  @Select("select * from agency_execution_jobs where tenant_id=#{t} and id=#{id} for update")
  Job lockJob(String t, String id);

  @Update(
      "update agency_execution_jobs set"
          + " status='failed',result_json='{}'::jsonb,error_text=#{error},finished_at=now() where"
          + " tenant_id=#{t} and id=#{id} and status='processing' and attempts=#{attempt} and"
          + " started_at is not distinct from #{started}")
  int failJobAttempt(
      String t, String id, int attempt, java.time.OffsetDateTime started, String error);

  @Select("select * from agency_plan_reminder_policies where tenant_id=#{t} and milestone_id=#{id}")
  ReminderPolicy reminderPolicy(String t, String id);

  @Select("select * from agency_plan_reminder_policies where tenant_id=#{t} and package_id=#{pkg}")
  List<ReminderPolicy> reminderPolicies(String t, String pkg);

  @Insert(
      "insert into"
          + " agency_plan_reminder_policies(tenant_id,milestone_id,package_id,settings_json,reason,updated_by)"
          + " values(#{t},#{id},#{pkg},cast(#{settings} as jsonb),#{reason},#{actor}) on"
          + " conflict(tenant_id,milestone_id) do update set settings_json=cast(#{settings} as"
          + " jsonb),version=agency_plan_reminder_policies.version+1,reason=#{reason},updated_by=#{actor},updated_at=now()"
          + " where agency_plan_reminder_policies.tenant_id=#{t}")
  void saveReminderPolicy(
      String t, String pkg, String id, String settings, String reason, String actor);

  @Select(
      "select m.* from agency_milestones m join agency_packages p on p.tenant_id=m.tenant_id and"
          + " p.id=m.package_id where m.tenant_id=#{t} and m.id>#{after} and p.status='approved'"
          + " and p.workflow_id is null and m.status in ('planned','doing') and"
          + " (m.due_at<=now()+interval '30 days' or m.legal_deadline<=now()+interval '30 days')"
          + " order by m.id limit 200")
  List<Milestone> reminderMilestones(String t, String after);

  @Insert(
      "insert into"
          + " agency_reminder_deliveries(id,tenant_id,package_id,milestone_id,milestone_version,policy_version,recipient_id,level,due_at)"
          + " values(#{id},#{t},#{m.packageId},#{m.id},#{m.version},#{policy},#{recipient},#{level},#{due})"
          + " on conflict(id) do nothing")
  void queueReminder(
      String t,
      String id,
      Milestone m,
      long policy,
      String recipient,
      String level,
      java.time.OffsetDateTime due);

  @Select(
      "select * from agency_reminder_deliveries where tenant_id=#{t} and package_id=#{pkg} order by"
          + " created_at desc,id limit 100")
  List<ReminderDelivery> reminderDeliveries(String t, String pkg);

  @Select("select * from agency_reminder_deliveries where tenant_id=#{t} and id=#{id}")
  ReminderDelivery reminderDelivery(String t, String id);

  @Select("select * from agency_reminder_deliveries where tenant_id=#{t} and id=#{id} for update")
  ReminderDelivery lockReminderDelivery(String t, String id);

  @Select(
      "select * from agency_reminder_deliveries where tenant_id=#{t} and id>#{after} and status in"
          + " ('pending','failed') and next_attempt_at<=now() order by id limit 200")
  List<ReminderDelivery> pendingReminders(String t, String after);

  @Update(
      "update agency_reminder_deliveries set"
          + " status='delivered',attempts=attempts+1,sent_at=#{sent},next_attempt_at=null,error_text=null,updated_at=now()"
          + " where tenant_id=#{t} and id=#{id} and status in ('pending','failed')")
  void deliveredReminder(String t, String id, java.time.OffsetDateTime sent);

  @Update(
      "update agency_reminder_deliveries set"
          + " status='failed',attempts=attempts+1,error_text='站内通知写入失败，将自动重试',next_attempt_at=now()+make_interval(secs=>least(3600,power(2,least(attempts,7))::integer*30)),updated_at=now()"
          + " where tenant_id=#{t} and id=#{id} and status in ('pending','failed')")
  void failedReminder(String t, String id);

  @Update(
      "update agency_reminder_deliveries set"
          + " status='cancelled',error_text=#{reason},next_attempt_at=null,updated_at=now() where"
          + " tenant_id=#{t} and id=#{id} and status in ('pending','failed')")
  void cancelReminder(String t, String id, String reason);

  @Update(
      "update agency_reminder_deliveries set"
          + " status='pending',next_attempt_at=now(),updated_at=now() where tenant_id=#{t} and"
          + " id=#{id} and status='failed'")
  int retryReminder(String t, String id);

  @Insert(
      "insert into"
          + " agency_plan_reminder_policies(tenant_id,milestone_id,package_id,settings_json,reason,updated_by)"
          + " values(#{t},#{id},#{pkg},cast(#{settings} as jsonb),#{reason},#{actor}) on"
          + " conflict(tenant_id,milestone_id) do nothing")
  void seedReminderPolicy(
      String t, String pkg, String id, String settings, String reason, String actor);

  @Select("select * from agency_participation_imports where tenant_id=#{t} and id=#{id}")
  ParticipationImport participationImport(String t, String id);

  @Insert(
      "insert into"
          + " agency_participation_imports(id,tenant_id,package_id,source_version_id,source_hash,source_name,rows_json,status,created_by)"
          + " values(#{id},#{t},#{pkg},#{source},#{hash},#{name},cast(#{rows} as"
          + " jsonb),#{status},#{actor})")
  void createParticipationImport(
      String t,
      String id,
      String pkg,
      String source,
      String hash,
      String name,
      String rows,
      String status,
      String actor);

  @Update(
      "update agency_participation_imports set"
          + " status='committed',version=version+1,result_json=cast(#{result} as"
          + " jsonb),committed_by=#{actor},committed_at=now() where tenant_id=#{t} and id=#{id} and"
          + " version=#{v} and status='preview'")
  int commitParticipationImport(String t, String id, long v, String result, String actor);

  @Update(
      "update agency_participations set import_id=#{importId},source_row=#{row} where"
          + " tenant_id=#{t} and id=#{id} and import_id is null")
  int linkParticipationImport(String t, String id, String importId, int row);

  @Select(
      "select id,source_name,source_version_id,status,version,jsonb_array_length(rows_json) as"
          + " row_count,created_at from agency_participation_imports where tenant_id=#{t} and"
          + " package_id=#{pkg} order by created_at desc,id limit 20")
  List<ParticipationImportSummary> recentParticipationImports(String t, String pkg);

  @Select(
      "select * from agency_preparation_people where tenant_id=#{t} and package_id=#{pkg} order by"
          + " created_at,id")
  List<PreparationPerson> preparationPeople(String t, String pkg);

  @Select("select * from agency_preparation_people where tenant_id=#{t} and id=#{id}")
  PreparationPerson preparationPerson(String t, String id);

  @Insert(
      "insert into"
          + " agency_preparation_people(id,tenant_id,package_id,name,organization,role,status,reason,created_by)"
          + " values(#{id},#{t},#{pkg},#{d.name},#{d.organization},#{d.role},#{d.status},#{d.reason},#{actor})")
  void preparationPersonCreate(
      String t, String pkg, String id, PreparationPersonDraft d, String actor);

  @Update(
      "update agency_preparation_people set"
          + " name=#{d.name},organization=#{d.organization},role=#{d.role},status=#{d.status},reason=#{d.reason},version=version+1,updated_at=now()"
          + " where tenant_id=#{t} and id=#{id} and version=#{v}")
  int preparationPersonUpdate(String t, String id, long v, PreparationPersonDraft d);

  @Select(
      "select * from agency_preparation_forms where tenant_id=#{t} and package_id=#{pkg} order by"
          + " created_at desc,id limit 100")
  List<PreparationForm> preparationForms(String t, String pkg);

  @Select("select * from agency_preparation_forms where tenant_id=#{t} and id=#{id}")
  PreparationForm preparationForm(String t, String id);

  @Select(
      "select coalesce(max(ordinal),0) from agency_preparation_forms where tenant_id=#{t} and"
          + " group_id=#{group}")
  int preparationFormOrdinal(String t, String group);

  @Insert(
      "insert into"
          + " agency_preparation_forms(id,tenant_id,package_id,group_id,ordinal,kind,code,title,people_json,basis_json,basis_hash,body_text,file_version_id,file_hash,supersedes_id,created_by)"
          + " values(#{f.id},#{f.tenantId},#{f.packageId},#{f.groupId},#{f.ordinal},#{f.kind},#{f.code},#{f.title},cast(#{f.peopleJson}"
          + " as jsonb),cast(#{f.basisJson} as"
          + " jsonb),#{f.basisHash},#{f.bodyText},#{f.fileVersionId},#{f.fileHash},#{f.supersedesId},#{f.createdBy})")
  void preparationFormCreate(@Param("f") PreparationForm f);

  @Update(
      "update agency_preparation_forms set status='voided',version=version+1,void_reason=#{reason}"
          + " where tenant_id=#{t} and id=#{id} and version=#{v} and status='generated'")
  int voidPreparationForm(String t, String id, long v, String reason);

  @Select(
      "select * from agency_preparation_returns where tenant_id=#{t} and package_id=#{pkg} order by"
          + " created_at desc,id limit 200")
  List<PreparationReturn> preparationReturns(String t, String pkg);

  @Select("select * from agency_preparation_returns where tenant_id=#{t} and id=#{id}")
  PreparationReturn preparationReturn(String t, String id);

  @Insert(
      "insert into"
          + " agency_preparation_returns(id,tenant_id,package_id,form_id,people_json,file_version_id,file_hash,signed_on,note,stale_reason,created_by)"
          + " values(#{r.id},#{r.tenantId},#{r.packageId},#{r.formId},cast(#{r.peopleJson} as"
          + " jsonb),#{r.fileVersionId},#{r.fileHash},#{r.signedOn},#{r.note},#{r.staleReason},#{r.createdBy})")
  void preparationReturnCreate(@Param("r") PreparationReturn r);

  @Select(
      "select person_id from agency_preparation_return_people where tenant_id=#{t} and"
          + " form_id=#{form} and active order by person_id")
  List<String> preparationSignedPeople(String t, String form);

  @Insert(
      "insert into agency_preparation_return_people(tenant_id,form_id,person_id,return_id)"
          + " values(#{t},#{form},#{person},#{ret})")
  void preparationReturnPerson(String t, String form, String person, String ret);

  @Update(
      "update agency_preparation_returns set"
          + " status='voided',version=version+1,void_reason=#{reason} where tenant_id=#{t} and"
          + " id=#{id} and version=#{v} and status='recorded'")
  int voidPreparationReturn(String t, String id, long v, String reason);

  @Update(
      "update agency_preparation_return_people set active=false where tenant_id=#{t} and"
          + " return_id=#{id}")
  void clearPreparationReturnPeople(String t, String id);
}
