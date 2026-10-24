package com.procurement.supplier.infrastructure;

import com.procurement.supplier.api.QualificationWorkflowContracts.*;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface QualificationWorkflowMapper {
  @Select("select v.relation_id from supplier_qualification_reviews v join buyer_supplier_relations r on r.id=v.relation_id where r.tenant_id=#{tenant} and v.id=#{review}")
  String relation(String tenant,long review);
  @Select("select supplier_id from buyer_supplier_relations where tenant_id=#{tenant} and id=#{relation}")
  String supplier(String tenant,String relation);
  @Select("select status from supplier_qualification_reviews where id=#{review} for update")
  @Options(useCache=false,flushCache=Options.FlushCachePolicy.TRUE)
  String lockReview(long review);
  @Insert("insert into qualification_workflow_attempts(id,tenant_id,review_id,reason,status,created_by) values(#{id},#{tenant},#{review},#{reason},'processing',#{actor})")
  void create(String id,String tenant,long review,String reason,String actor);
  @Update("update qualification_workflow_attempts set workflow_instance_id=#{instance} where id=#{id} and tenant_id=#{tenant} and workflow_instance_id is null")
  int bind(String tenant,String id,String instance);
  @Select("select * from qualification_workflow_attempts where tenant_id=#{tenant} and id=#{id}")
  Attempt find(String tenant,String id);
  @Select("select * from qualification_workflow_attempts where tenant_id=#{tenant} and review_id=#{review} and status='processing'")
  Attempt active(String tenant,long review);
  String ATTEMPT_SCOPE="<if test='scope.restricted'><choose><when test='scope.requesterId != null'>and a.created_by=#{scope.requesterId}</when><when test='scope.departmentIds.size() > 0'>and w.department_id in <foreach collection='scope.departmentIds' item='d' open='(' separator=',' close=')'>#{d}</foreach></when><otherwise>and false</otherwise></choose></if>";
  String ATTEMPTS="from qualification_workflow_attempts a left join workflow_business_instances w on w.tenant_id=a.tenant_id and w.id=a.workflow_instance_id where a.tenant_id=#{tenant} and a.review_id=#{review} ";
  @Select("<script>select a.* "+ATTEMPTS+ATTEMPT_SCOPE+" order by a.created_at desc,a.id limit #{size} offset #{offset}</script>")
  List<Attempt> history(String tenant,long review,com.procurement.identity.domain.DataScope scope,int size,long offset);
  @Select("<script>select count(*) "+ATTEMPTS+ATTEMPT_SCOPE+"</script>")
  long count(String tenant,long review,com.procurement.identity.domain.DataScope scope);
  @Update("update qualification_workflow_attempts set status=#{status},completed_at=now() where tenant_id=#{tenant} and id=#{id} and status='processing' and workflow_instance_id=#{instance}")
  int finish(String tenant,String id,String instance,String status);
  @Select("select u.department_id from users u join departments d on d.id=u.department_id and d.tenant_id=u.tenant_id and d.status='active' where u.id=#{actor} and u.tenant_id=#{tenant}")
  String department(String tenant,String actor);

  String SUPPLEMENT="select s.*,r.supplier_id,e.name supplier_name,t.name tenant_name,q.qualification_type from qualification_supplement_requests s join buyer_supplier_relations r on r.id=s.relation_id and r.tenant_id=s.tenant_id join enterprises e on e.id=r.supplier_id join tenants t on t.id=s.tenant_id join supplier_qualifications q on q.id=s.qualification_id ";
  String FILTER="<if test='tenant != null'>and s.tenant_id=#{tenant}</if><if test='supplier != null'>and r.supplier_id=#{supplier}</if><if test='relation != null and relation != \"\"'>and s.relation_id=#{relation}</if>";
  @Select("<script>"+SUPPLEMENT+" where 1=1 "+FILTER+" order by s.created_at desc,s.id limit #{size} offset #{offset}</script>")
  List<Supplement> supplements(String tenant,String supplier,String relation,int size,long offset);
  @Select("<script>select count(*) from qualification_supplement_requests s join buyer_supplier_relations r on r.id=s.relation_id where 1=1 "+FILTER+"</script>")
  long countSupplements(String tenant,String supplier,String relation);
  @Select(SUPPLEMENT+"where s.status in ('requested','returned') and s.due_date<=#{date}")
  List<Supplement> due(java.time.LocalDate date);
  @Select(SUPPLEMENT+"where s.id=#{id} for update of s")
  Supplement lockSupplement(String id);
  @Select(SUPPLEMENT+"where s.id=#{id}")
  Supplement supplement(String id);
  @Select("select exists(select 1 from buyer_supplier_relations r join supplier_qualifications q on q.supplier_id=r.supplier_id where r.tenant_id=#{tenant} and r.id=#{relation} and q.id=#{qualification} and q.replaced_by is null)")
  boolean belongs(String tenant,String relation,String qualification);
  @Insert("insert into qualification_supplement_requests(id,tenant_id,relation_id,qualification_id,reason,due_date,status,created_by) values(#{id},#{tenant},#{relation},#{qualification},#{reason},#{due},'requested',#{actor})")
  void requestSupplement(String id,String tenant,String relation,String qualification,String reason,java.time.LocalDate due,String actor);
  @Update("update qualification_supplement_requests set status='submitted',revision=revision+1,replacement_id=#{replacement},response=#{response},responded_by=#{actor},responded_at=now() where id=#{id} and revision=#{revision} and status in ('requested','returned')")
  int reply(String id,long revision,String replacement,String response,String actor);
  @Select("with recursive chain as(select id,replaced_by from supplier_qualifications where supplier_id=#{supplier} and id=#{old} union all select q.id,q.replaced_by from supplier_qualifications q join chain c on q.id=c.replaced_by where q.supplier_id=#{supplier}) select exists(select 1 from chain where id=#{replacement} and id<>#{old} and replaced_by is null)")
  boolean replacement(String supplier,String old,String replacement);
  @Select("select status from supplier_qualification_reviews where relation_id=#{relation} and qualification_id=#{qualification}")
  String reviewStatus(String relation,String qualification);
  @Update("update qualification_supplement_requests set status=#{status},revision=revision+1,closed_at=case when #{status}='closed' then now() else null end where tenant_id=#{tenant} and relation_id=#{relation} and replacement_id=#{qualification} and status='submitted'")
  int settleSupplements(String tenant,String relation,String qualification,String status);
  @Update("update qualification_supplement_requests set status='cancelled',revision=revision+1,closed_at=now() where tenant_id=#{tenant} and id=#{id} and revision=#{revision} and status in ('requested','returned')")
  int cancelSupplement(String tenant,String id,long revision);
}
