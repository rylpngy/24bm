package com.procurement.agency.infrastructure;

import java.util.*;
import org.apache.ibatis.annotations.*;
import com.procurement.agency.domain.AgencyWorkbenchRecords.*;

@Mapper
public interface AgencyWorkbenchMapper {
  String SCOPE = """
    p.tenant_id=#{t} and (#{all} or p.created_by=#{actor} or p.owner_id=#{actor}
    or exists(select 1 from agency_members m where m.tenant_id=p.tenant_id and m.package_id=p.id and m.user_id=#{actor} and m.active)
    <if test="departments != null and !departments.isEmpty()">or p.department_id in <foreach collection="departments" item="dep" open="(" close=")" separator=",">#{dep}</foreach></if>)
    """;
  @Select("<script>select p.id as package_id,p.title,p.number,p.procurement_method,u.name as owner_name,d.settings_json-&gt;&gt;'openingAt' as opening_at,d.settings_json-&gt;&gt;'venue' as venue from agency_packages p join agency_documents d on d.tenant_id=p.tenant_id and d.package_id=p.id and d.kind='purchase' left join users u on u.tenant_id=p.tenant_id and u.id=p.owner_id where " + SCOPE + " and coalesce(d.settings_json-&gt;&gt;'openingAt','') != '' order by p.id</script>")
  List<CalendarRow> calendar(String t,String actor,boolean all,List<String> departments);

  @Select("<script>select p.id as package_id,p.title,p.number,p.procurement_method,d.id as document_id,d.kind,d.status,r.id as revision_id,r.status as revision_status,r.input_version,r.created_at from agency_packages p join agency_documents d on d.tenant_id=p.tenant_id and d.package_id=p.id left join agency_document_revisions r on r.tenant_id=d.tenant_id and r.document_id=d.id where " + SCOPE + " and (#{keyword}='' or p.title ilike '%'||#{keyword}||'%' or p.number ilike '%'||#{keyword}||'%') and (#{kind}='' or d.kind=#{kind}) order by d.updated_at desc,r.created_at desc nulls last,d.id limit #{limit} offset #{offset}</script>")
  List<DocumentRow> documents(String t,String actor,boolean all,List<String> departments,String keyword,String kind,int limit,int offset);
  @Select("<script>select count(*) from agency_packages p join agency_documents d on d.tenant_id=p.tenant_id and d.package_id=p.id left join agency_document_revisions r on r.tenant_id=d.tenant_id and r.document_id=d.id where " + SCOPE + " and (#{keyword}='' or p.title ilike '%'||#{keyword}||'%' or p.number ilike '%'||#{keyword}||'%') and (#{kind}='' or d.kind=#{kind})</script>")
  long documentCount(String t,String actor,boolean all,List<String> departments,String keyword,String kind);
}
