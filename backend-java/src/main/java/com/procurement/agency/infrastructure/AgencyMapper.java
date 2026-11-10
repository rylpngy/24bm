package com.procurement.agency.infrastructure;

import com.procurement.agency.domain.AgencyRecords.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface AgencyMapper {
  @Update(
      "update agency_packages set workflow_id=#{workflow} where tenant_id=#{tenant} and id=#{id}")
  void bindPackageWorkflow(String tenant, String id, String workflow);

  @Select(
      """
select * from agency_groups where tenant_id=#{tenant} and (#{keyword}='' or name ilike '%'||#{keyword}||'%') order by created_at desc limit 100
""")
  List<Group> groups(String tenant, String keyword);

  @Select(
      """
select * from agency_groups where tenant_id=#{tenant} and id=#{id}
""")
  Group group(String tenant, String id);

  @Insert(
      """
insert into agency_groups(id,tenant_id,name,tags,created_by) values(#{id},#{tenant},#{name},#{tags},#{actor})
""")
  void insertGroup(String tenant, String id, String name, String tags, String actor);

  @Select(
      """
select * from agency_packages where tenant_id=#{tenant} and id=#{id}
""")
  PackageRow find(String tenant, String id);

  @Select(
      """
select * from agency_packages where tenant_id=#{tenant} and id=#{id} for update
""")
  PackageRow lock(String tenant, String id);

  @Select(
      """
<script>select p.* from agency_packages p where p.tenant_id=#{tenant} and (p.created_by=#{actor} or p.owner_id=#{actor}
 or exists(select 1 from agency_members m where m.tenant_id=p.tenant_id and m.package_id=p.id and m.user_id=#{actor} and m.active)
 or #{all}
 <if test="departments != null and !departments.isEmpty()">or p.department_id in <foreach collection="departments" item="d" open="(" close=")" separator=",">#{d}</foreach></if>)
 and (#{status}='' or p.status=#{status}) and (#{group}='' or p.group_id=#{group})
 and (#{method}='' or p.procurement_method=#{method}) and (#{owner}='' or p.owner_id=#{owner})
 and (#{keyword}='' or p.title ilike '%'||#{keyword}||'%' or p.number ilike '%'||#{keyword}||'%') order by p.created_at desc,p.id limit #{limit} offset #{offset}</script>
""")
  List<PackageRow> list(
      String tenant,
      String actor,
      boolean all,
      List<String> departments,
      String status,
      String group,
      String method,
      String owner,
      String keyword,
      int limit,
      int offset);

  @Select(
      """
<script>select count(*) from agency_packages p where p.tenant_id=#{tenant} and (p.created_by=#{actor} or p.owner_id=#{actor}
 or exists(select 1 from agency_members m where m.tenant_id=p.tenant_id and m.package_id=p.id and m.user_id=#{actor} and m.active)
 or #{all}
 <if test="departments != null and !departments.isEmpty()">or p.department_id in <foreach collection="departments" item="d" open="(" close=")" separator=",">#{d}</foreach></if>)
 and (#{status}='' or p.status=#{status}) and (#{group}='' or p.group_id=#{group})
 and (#{method}='' or p.procurement_method=#{method}) and (#{owner}='' or p.owner_id=#{owner})
 and (#{keyword}='' or p.title ilike '%'||#{keyword}||'%' or p.number ilike '%'||#{keyword}||'%')</script>
""")
  int count(
      String tenant,
      String actor,
      boolean all,
      List<String> departments,
      String status,
      String group,
      String method,
      String owner,
      String keyword);

  @Select(
      """
<script>select p.* from agency_packages p where p.tenant_id=#{tenant} and p.group_id=#{group} and (p.created_by=#{actor} or p.owner_id=#{actor}
 or exists(select 1 from agency_members m where m.tenant_id=p.tenant_id and m.package_id=p.id and m.user_id=#{actor} and m.active)
 or #{all}
 <if test="departments != null and !departments.isEmpty()">or p.department_id in <foreach collection="departments" item="d" open="(" close=")" separator=",">#{d}</foreach></if>) order by p.id</script>
""")
  List<PackageRow> groupPackages(
      String tenant, String group, String actor, boolean all, List<String> departments);

  @Insert(
      """
insert into agency_packages(id,tenant_id,group_id,title,business_category,object_code,procurement_method,regime,region,operating_mode,department_id,owner_id,budget,ceiling,currency,data_json,created_by) values(#{id},#{tenant},#{d.groupId},#{d.title},#{d.businessCategory},#{d.objectCode},#{d.procurementMethod},#{d.regime},#{d.region},#{d.operatingMode},#{d.departmentId},#{d.ownerId},#{d.budget},#{d.ceiling},#{d.currency},cast(#{json} as jsonb),#{actor})
""")
  void create(
      String tenant,
      String id,
      com.procurement.agency.domain.AgencyRecords.Draft d,
      String json,
      String actor);

  @Update(
      """
update agency_packages set group_id=#{d.groupId},title=#{d.title},business_category=#{d.businessCategory},object_code=#{d.objectCode},procurement_method=#{d.procurementMethod},regime=#{d.regime},region=#{d.region},operating_mode=#{d.operatingMode},department_id=#{d.departmentId},owner_id=#{d.ownerId},budget=#{d.budget},ceiling=#{d.ceiling},currency=#{d.currency},data_json=cast(#{json} as jsonb),version=version+1,updated_at=now() where tenant_id=#{tenant} and id=#{id} and version=#{version}
""")
  int edit(
      String tenant,
      String id,
      long version,
      com.procurement.agency.domain.AgencyRecords.Draft d,
      String json);

  @Update(
      """
update agency_packages set status=#{status},workflow_id=#{workflow},version=version+1,updated_at=now() where tenant_id=#{tenant} and id=#{id} and version=#{version}
""")
  int state(String tenant, String id, long version, String status, String workflow);

  @Update(
      """
update agency_packages set number=#{number},business_year=#{year},serial=#{serial} where tenant_id=#{tenant} and id=#{id} and number is null
""")
  int number(String tenant, String id, String number, int year, int serial);

  @Select(
      """
select m.user_id,m.role,u.name from agency_members m join users u on u.id=m.user_id and u.tenant_id=m.tenant_id where m.tenant_id=#{tenant} and m.package_id=#{id} and m.active order by m.role,m.user_id
""")
  List<MemberRow> members(String tenant, String id);

  @Update(
      """
update agency_members set active=false,ended_at=now() where tenant_id=#{tenant} and package_id=#{id} and active
""")
  void endMembers(String tenant, String id);

  @Insert(
      """
insert into agency_members(tenant_id,package_id,user_id,role) values(#{tenant},#{id},#{user},#{role})
""")
  void member(String tenant, String id, String user, String role);

  @Insert(
      """
insert into agency_package_history(tenant_id,package_id,version,data_json,reason,actor_id) values(#{tenant},#{id},#{version},cast(#{json} as jsonb),#{reason},#{actor})
""")
  void insertHistory(
      String tenant, String id, long version, String json, String reason, String actor);

  @Select(
      """
select version,data_json,reason,actor_id,created_at from agency_package_history where tenant_id=#{tenant} and package_id=#{id} order by version desc
""")
  List<History> history(String tenant, String id);

  @Insert(
      """
insert into agency_numbering_config(tenant_id) values(#{tenant}) on conflict do nothing
""")
  void ensureNumbering(String tenant);

  @Select(
      """
select * from agency_numbering_config where tenant_id=#{tenant}
""")
  Numbering numbering(String tenant);

  @Select(
      """
select * from agency_numbering_config where tenant_id=#{tenant} for update
""")
  Numbering lockNumbering(String tenant);

  @Update(
      """
update agency_numbering_config set pattern=#{pattern},time_zone=#{zone},categories=cast(#{categories} as jsonb),objects=cast(#{objects} as jsonb),version=version+1 where tenant_id=#{tenant} and version=#{version}
""")
  int numberingConfig(
      String tenant, long version, String pattern, String zone, String categories, String objects);

  @Select(
      """
insert into agency_annual_sequences(tenant_id,business_year,last_serial) values(#{tenant},#{year},1)
 on conflict(tenant_id,business_year) do update set last_serial=agency_annual_sequences.last_serial+1 where agency_annual_sequences.tenant_id=#{tenant} and agency_annual_sequences.last_serial<9999 returning last_serial
""")
  Integer nextSerial(String tenant, int year);

  @Insert(
      """
insert into agency_reviews(id,tenant_id,package_id,kind,base_version,proposed_json,snapshot_json,status,requested_by)
 values(#{id},#{tenant},#{packageId},#{kind},#{version},cast(#{proposed} as jsonb),cast(#{snapshot} as jsonb),'processing',#{actor})
""")
  void review(
      String tenant,
      String id,
      String packageId,
      String kind,
      long version,
      String proposed,
      String snapshot,
      String actor);

  @Update(
      """
update agency_reviews set workflow_id=#{workflow} where tenant_id=#{tenant} and id=#{id}
""")
  void bindReview(String tenant, String id, String workflow);

  @Select(
      """
select * from agency_reviews where tenant_id=#{tenant} and package_id=#{id} order by created_at desc,id
""")
  List<Review> reviews(String tenant, String id);

  @Select(
      """
select * from agency_reviews where tenant_id=#{tenant} and id=#{id} for update
""")
  Review lockReview(String tenant, String id);

  @Select(
      """
select * from agency_reviews where tenant_id=#{tenant} and id=#{id}
""")
  Review reviewById(String tenant, String id);

  @Update(
      """
update agency_reviews set status=#{status},comment=#{comment} where tenant_id=#{tenant} and id=#{id} and status='processing'
""")
  int completeReview(String tenant, String id, String status, String comment);

  @Select(
      """
select fingerprint,response_json from agency_idempotency where tenant_id=#{tenant} and request_key=#{key}
""")
  Idempotency idempotency(String tenant, String key);

  @Select(
      """
select pg_advisory_xact_lock(hashtextextended(#{tenant}||':'||#{key},0))
""")
  String lockRequest(String tenant, String key);

  @Insert(
      """
insert into agency_idempotency(tenant_id,request_key,fingerprint,response_json) values(#{tenant},#{key},#{fingerprint},cast(#{response} as jsonb))
""")
  void remember(String tenant, String key, String fingerprint, String response);

  @Select(
      """
select * from agency_files where tenant_id=#{tenant} and package_id=#{id} order by created_at,id
""")
  List<FileRow> files(String tenant, String id);

  @Select(
      """
select * from agency_files where tenant_id=#{tenant} and id=#{id}
""")
  FileRow file(String tenant, String id);

  @Select(
      """
select * from agency_files where tenant_id=#{tenant} and id=#{id} for update
""")
  FileRow lockFile(String tenant, String id);

  @Insert(
      """
insert into agency_files(id,tenant_id,package_id,name,category,visibility,created_by) values(#{id},#{tenant},#{packageId},#{name},#{category},#{visibility},#{actor})
""")
  void createFile(
      String tenant,
      String id,
      String packageId,
      String name,
      String category,
      String visibility,
      String actor);

  @Select(
      """
select * from agency_file_versions where tenant_id=#{tenant} and file_id=#{id} order by ordinal desc
""")
  List<FileVersion> versions(String tenant, String id);

  @Select(
      """
select * from agency_file_versions where tenant_id=#{tenant} and id=#{id}
""")
  FileVersion version(String tenant, String id);

  @Select(
      """
select * from agency_file_versions where tenant_id=#{tenant} and id=#{id} for update
""")
  FileVersion lockVersion(String tenant, String id);

  @Insert(
      """
insert into agency_file_versions(id,tenant_id,file_id,ordinal,status,created_by,reason) values(#{id},#{tenant},#{file},#{ordinal},'uploading',#{actor},#{reason})
""")
  void createVersion(
      String tenant, String id, String file, int ordinal, String actor, String reason);

  @Update(
      """
update agency_file_versions set status='sealed',attachment_id=#{attachment},hash=#{hash},content_size=#{size} where tenant_id=#{tenant} and id=#{id} and status='uploading'
""")
  int seal(String tenant, String id, String attachment, String hash, long size);

  @Update(
      """
update agency_file_versions set status='cancelled',reason=#{reason} where tenant_id=#{tenant} and id=#{id} and status='uploading'
""")
  int cancelVersion(String tenant, String id, String reason);

  @Select(
      """
select count(*) from agency_file_versions v join agency_files f on f.tenant_id=v.tenant_id and f.id=v.file_id where v.tenant_id=#{tenant} and f.package_id=#{id} and v.status='uploading' and f.category not in ('response_material','final_quote_material')
""")
  int pendingFiles(String tenant, String id);
}
