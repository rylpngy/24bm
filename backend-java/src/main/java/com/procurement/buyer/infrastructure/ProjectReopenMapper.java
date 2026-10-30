package com.procurement.buyer.infrastructure;

import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ProjectReopenMapper {
  @Insert(
      "insert into project_reopen_archives(tenant_id,request_id,sha256,file_bytes)"
          + " values(#{t},#{id},#{sha},#{bytes})")
  void insertArchive(
      @Param("t") String t,
      @Param("id") String id,
      @Param("sha") String sha,
      @Param("bytes") byte[] bytes);

  record Archive(String sha256, byte[] bytes) {}

  @Select(
      "select sha256,file_bytes bytes from project_reopen_archives where tenant_id=#{t} and"
          + " request_id=#{id}")
  Archive findArchive(@Param("t") String t, @Param("id") String id);

  @Select(
      "select a.sha256,a.file_bytes bytes from project_reopen_archives a join"
          + " procurement_project_lifecycle_requests r on r.tenant_id=a.tenant_id and"
          + " r.id=a.request_id where r.tenant_id=#{t} and r.project_id=#{p} and"
          + " r.project_revision=#{revision} and r.kind='reopen' order by r.created_at,r.id limit"
          + " 1")
  Archive closureForRevision(
      @Param("t") String t, @Param("p") String project, @Param("revision") int revision);

  @Select(
      """
with o as(select po.id from purchase_orders po where po.tenant_id=#{t} and exists(select 1 from rfq_demands r join procurement_project_demands d on d.tenant_id=r.tenant_id and d.demand_id=r.demand_id where r.tenant_id=po.tenant_id and r.rfq_id=po.rfq_id and d.project_id=#{p}))
select jsonb_build_object(
'orders',coalesce((select jsonb_agg(to_jsonb(po) order by po.id) from purchase_orders po join o on o.id=po.id where po.tenant_id=#{t}),'[]'::jsonb),
'contracts',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from contracts c join o on o.id=c.related_order_id where c.tenant_id=#{t}),'[]'::jsonb),
'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from invoices i join o on o.id=i.order_id where i.tenant_id=#{t}),'[]'::jsonb),
'deliveries',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from deliveries d join o on o.id=d.order_id where d.tenant_id=#{t}),'[]'::jsonb),
'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from receipts r join o on o.id=r.order_id where r.tenant_id=#{t}),'[]'::jsonb),
'settlements',coalesce((select jsonb_agg(to_jsonb(s)-'agreement_bytes' order by s.id) from order_settlements s join o on o.id=s.order_id where s.tenant_id=#{t}),'[]'::jsonb))::text
""")
  String financialBasis(@Param("t") String t, @Param("p") String p);

  @Select(
      "select exists(select 1 from workflow_business_instances where tenant_id=#{t} and"
          + " business_type='project_initiation' and business_id=#{p} and status='approved')")
  boolean approved(@Param("t") String t, @Param("p") String p);

  @Select(
      """
select count(*) from order_settlements s join purchase_orders o on o.tenant_id=s.tenant_id and o.id=s.order_id
where s.tenant_id=#{t} and s.status not in ('settled','withdrawn','rejected') and exists(select 1 from rfq_demands r join procurement_project_demands d on d.tenant_id=r.tenant_id and d.demand_id=r.demand_id where r.tenant_id=o.tenant_id and r.rfq_id=o.rfq_id and d.project_id=#{p})
""")
  int pendingSettlements(@Param("t") String t, @Param("p") String p);

  @Select(
      """
select a.id from procurement_execution_archives a where a.tenant_id=#{t} and exists(select 1 from rfq_demands r join procurement_project_demands d on d.tenant_id=r.tenant_id and d.demand_id=r.demand_id where r.tenant_id=a.tenant_id and r.rfq_id=a.rfq_id and d.project_id=#{p}) order by a.id
""")
  List<String> archives(@Param("t") String t, @Param("p") String p);

  @Select(
      """
select r.id from procurement_project_lifecycle_requests r where r.tenant_id=#{t} and r.kind='reopen' and r.status='approved'
and exists(select 1 from purchase_orders o join rfq_demands rd on rd.tenant_id=o.tenant_id and rd.rfq_id=o.rfq_id join procurement_project_demands d on d.tenant_id=rd.tenant_id and d.demand_id=rd.demand_id
where o.tenant_id=r.tenant_id and o.id=#{o} and d.project_id=r.project_id and
 ((r.snapshot->'reopen'->>'packageId' is null and not exists(select 1 from procurement_project_package_demands bd where bd.tenant_id=d.tenant_id and bd.demand_id=d.demand_id))
 or exists(select 1 from procurement_project_package_demands bd where bd.tenant_id=d.tenant_id and bd.demand_id=d.demand_id and bd.package_id=r.snapshot->'reopen'->>'packageId')))
order by r.created_at desc,r.id desc limit 1
""")
  String orderGrant(@Param("t") String t, @Param("o") String order);
}
