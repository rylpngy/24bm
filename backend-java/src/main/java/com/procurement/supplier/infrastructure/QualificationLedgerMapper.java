package com.procurement.supplier.infrastructure;

import com.procurement.supplier.api.QualificationLedgerRow;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface QualificationLedgerMapper {
  String FROM = """
      from supplier_qualifications q
      join buyer_supplier_relations r on r.supplier_id=q.supplier_id
      join enterprises e on e.id=r.supplier_id
      where r.tenant_id=#{tenantId} and q.status='active' and q.replaced_by is null
      <if test="keyword != null">and (strpos(lower(e.name),lower(#{keyword})) > 0
        or strpos(lower(coalesce(q.certificate_no,'')),lower(#{keyword})) > 0
        or strpos(lower(q.qualification_type),lower(#{keyword})) > 0)</if>
      <if test="state == 'expired'">and q.expires_at &lt; #{today}</if>
      <if test="state == 'expiring'">and q.expires_at between #{today} and #{until}</if>
      <if test="state == 'unknown'">and q.expires_at is null</if>
      <if test="state == 'valid'">and q.expires_at > #{until}</if>
      """;

  @Select("<script>select count(*) " + FROM + "</script>")
  long count(String tenantId, String keyword, String state, LocalDate today, LocalDate until);

  @Select("""
      <script>select r.id as relation_id,e.name as supplier_name,r.status as relation_status,
      q.id as qualification_id,q.qualification_type,q.certificate_no,q.expires_at,
      case when q.expires_at is null then 'unknown' when q.expires_at &lt; #{today} then 'expired'
      when q.expires_at &lt;= #{until} then 'expiring' else 'valid' end as expiry_state
      """ + FROM + " order by q.expires_at asc nulls last,r.id,q.id limit #{limit} offset #{offset}</script>")
  List<QualificationLedgerRow> list(String tenantId, String keyword, String state, LocalDate today,
      LocalDate until, int limit, long offset);
}
