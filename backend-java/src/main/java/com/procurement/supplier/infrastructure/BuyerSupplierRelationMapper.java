package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.BuyerSupplierRelation;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface BuyerSupplierRelationMapper {

  @Select("select id from buyer_supplier_relations where tenant_id = #{tenantId} and id = #{id} for update")
  @org.apache.ibatis.annotations.Options(flushCache = org.apache.ibatis.annotations.Options.FlushCachePolicy.TRUE)
  String lockRelation(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      with scoped_orders as (
        select * from purchase_orders where tenant_id = #{tenantId} and supplier_id = #{supplierId}
      ), scoped_invoices as (
        select * from invoices where tenant_id = #{tenantId} and
          (supplier_id = #{supplierId} or order_id in (select id from scoped_orders))
      ), scoped_contracts as (
        select * from contracts where tenant_id = #{tenantId} and supplier_id = #{supplierId}
      ), milestone_balances as (
        select m.*, coalesce((select sum(a.amount) from contract_payment_allocations a
          where a.tenant_id = #{tenantId} and a.milestone_id = m.id), 0) as paid
        from contract_payment_milestones m join scoped_contracts c on c.id = m.contract_id
        where m.tenant_id = #{tenantId}
      ), schedules as (
        select contract_id, sum(amount) as amount, sum(paid) as paid,
          bool_or(amount is null or paid < 0 or paid > amount or status is distinct from
            case when paid = 0 then '待付' when paid = amount then '已付' else '部分已付' end) as invalid
        from milestone_balances group by contract_id
      ), balances as (
        select i.*, coalesce((select sum(e.amount) from invoice_payment_entries e
          where e.tenant_id = #{tenantId} and e.invoice_id = i.id), 0) as paid
        from scoped_invoices i
      ), checked as (
        select i.*, (i.paid < 0 or i.paid > i.amount or i.payment_status is distinct from
          case when i.paid = 0 then '待付款' when i.paid = i.amount then '已付款' else '部分付款' end
          or i.supplier_id <> #{supplierId} or not exists (select 1 from scoped_orders o
            where o.id = i.order_id and o.amount = i.amount)
          or (select count(*) from scoped_invoices other where other.order_id = i.order_id) <> 1
          or (c.id is not null and c.amount is distinct from i.amount)
          or coalesce(s.invalid, false) or (s.contract_id is not null and
            (s.paid <> i.paid or s.amount <> i.amount))) as verification
        from balances i left join scoped_contracts c on c.related_order_id = i.order_id
        left join schedules s on s.contract_id = c.id
      ), risks as (
        select
          (select count(*) from scoped_orders where status is distinct from '已收货') as unreceived_order_count,
          count(*) filter (where payment_status <> '已付款' or verification or paid < amount) as unpaid_invoice_count,
          coalesce(sum(amount) filter (where payment_status <> '已付款' or verification or paid < amount), 0) as unpaid_invoice_face_amount,
          (select count(*) from scoped_contracts where archive_status is distinct from '已归档') as unarchived_contract_count,
          (select count(*) from mall_after_sales where tenant_id = #{tenantId} and supplier_id = #{supplierId}
            and (status is null or status not in ('已完成', '已拒绝'))) as open_after_sales_count,
          (select count(*) from scoped_orders o where o.amount < 0 or
            coalesce((select sum(i.amount) from scoped_invoices i where i.order_id = o.id), 0) < o.amount) as uninvoiced_order_count,
          count(*) filter (where verification) as payment_verification_required_count,
          case when count(*) filter (where verification) > 0 then null
            else coalesce(sum(amount - paid), 0) end as remaining_invoice_amount
        from checked
      ) select *, (unreceived_order_count > 0 or unpaid_invoice_count > 0 or
        unarchived_contract_count > 0 or open_after_sales_count > 0 or uninvoiced_order_count > 0 or
        payment_verification_required_count > 0 or remaining_invoice_amount is null or
        remaining_invoice_amount > 0) as blocked from risks
      """)
  @org.apache.ibatis.annotations.Options(flushCache = org.apache.ibatis.annotations.Options.FlushCachePolicy.TRUE)
  com.procurement.supplier.api.SupplierExitRiskResponse exitRisk(
      @Param("tenantId") String tenantId, @Param("supplierId") String supplierId);

  @Select("""
      <script>
      select r.id, r.tenant_id, r.supplier_id, e.name as supplier_name, r.status, r.level,
             r.categories::text as categories_json, r.performance_score,
             r.cooperation_tier, r.last_evaluation_score,
             coalesce(r.credit_code, s.credit_code) as credit_code,
             coalesce(r.legal_person, s.legal_person) as legal_person,
             r.contact_name, r.contact_phone, r.contact_email,
             coalesce(r.business_scope, s.business_scope) as business_scope,
             r.bank_name, r.bank_account
      from buyer_supplier_relations r
      join enterprises e on e.id = r.supplier_id
      left join supplier_enterprises s on s.enterprise_id = r.supplier_id
      where r.tenant_id = #{tenantId}
        <if test="status != null and status != ''">
        and r.status = #{status}
        </if>
        <if test="level != null and level != ''">
        and r.level = #{level}
        </if>
        <if test="category != null and category != ''">
        and jsonb_exists(r.categories, #{category})
        </if>
        <if test="keyword != null and keyword != ''">
        and (
          e.name ilike concat('%', #{keyword}, '%')
          or r.supplier_id ilike concat('%', #{keyword}, '%')
        )
        </if>
      order by r.created_at desc
      </script>
      """)
  List<BuyerSupplierRelation> listByTenant(
      @Param("tenantId") String tenantId,
      @Param("status") String status,
      @Param("level") String level,
      @Param("category") String category,
      @Param("keyword") String keyword);

  @Select("""
      select r.id, r.tenant_id, r.supplier_id, e.name as supplier_name, r.status, r.level,
             r.categories::text as categories_json, r.performance_score,
             r.cooperation_tier, r.last_evaluation_score,
             coalesce(r.credit_code, s.credit_code) as credit_code,
             coalesce(r.legal_person, s.legal_person) as legal_person,
             r.contact_name, r.contact_phone, r.contact_email,
             coalesce(r.business_scope, s.business_scope) as business_scope,
             r.bank_name, r.bank_account
      from buyer_supplier_relations r
      join enterprises e on e.id = r.supplier_id
      left join supplier_enterprises s on s.enterprise_id = r.supplier_id
      where r.tenant_id = #{tenantId} and r.id = #{id}
      """)
  BuyerSupplierRelation findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into buyer_supplier_relations (id, tenant_id, supplier_id, status, level, categories)
      values (#{id}, #{tenantId}, #{supplierId}, #{status}, #{level}, #{categoriesJson}::jsonb)
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId,
      @Param("status") String status,
      @Param("level") String level,
      @Param("categoriesJson") String categoriesJson);

  @Select("""
      select count(1)
      from buyer_supplier_relations
      where tenant_id = #{tenantId}
        and supplier_id = #{supplierId,jdbcType=VARCHAR}
        and status = #{status,jdbcType=VARCHAR}
      """)
  int countByTenantSupplierAndStatus(
      @Param("tenantId") String tenantId,
      @Param("supplierId") String supplierId,
      @Param("status") String status);

  @Select("""
      select count(1)
      from buyer_supplier_relations
      where tenant_id = #{tenantId}
        and supplier_id = #{supplierId}
      """)
  int countByTenantSupplier(
      @Param("tenantId") String tenantId, @Param("supplierId") String supplierId);

  @Update("""
      update buyer_supplier_relations
      set status = #{status},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
        and status = #{currentStatus}
      """)
  int updateStatus(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("currentStatus") String currentStatus,
      @Param("status") String status);

  @Update("""
      update buyer_supplier_relations
      set level = #{level},
          categories = #{categoriesJson}::jsonb,
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  void updateProfile(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("level") String level,
      @Param("categoriesJson") String categoriesJson);

  // Null leaves an existing value unchanged; an empty string explicitly clears it.
  @Update("""
      update buyer_supplier_relations
      set credit_code = coalesce(#{creditCode,jdbcType=VARCHAR}, credit_code),
          legal_person = coalesce(#{legalPerson,jdbcType=VARCHAR}, legal_person),
          contact_name = coalesce(#{contactName,jdbcType=VARCHAR}, contact_name),
          contact_phone = coalesce(#{contactPhone,jdbcType=VARCHAR}, contact_phone),
          contact_email = coalesce(#{contactEmail,jdbcType=VARCHAR}, contact_email),
          business_scope = coalesce(#{businessScope,jdbcType=VARCHAR}, business_scope),
          bank_name = coalesce(#{bankName,jdbcType=VARCHAR}, bank_name),
          bank_account = coalesce(#{bankAccount,jdbcType=VARCHAR}, bank_account),
          updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  void updatePrivateProfile(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("creditCode") String creditCode,
      @Param("legalPerson") String legalPerson,
      @Param("contactName") String contactName,
      @Param("contactPhone") String contactPhone,
      @Param("contactEmail") String contactEmail,
      @Param("businessScope") String businessScope,
      @Param("bankName") String bankName,
      @Param("bankAccount") String bankAccount);

  @Update("""
      update buyer_supplier_relations
      set performance_score = #{performanceScore},
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  void updatePerformanceScore(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("performanceScore") BigDecimal performanceScore);

  @Update("""
      update buyer_supplier_relations
      set cooperation_tier = #{cooperationTier},
          last_evaluation_score = #{lastEvaluationScore},
          last_evaluated_at = now(),
          updated_at = now()
      where tenant_id = #{tenantId}
        and id = #{id}
      """)
  void updateCooperationTier(
      @Param("tenantId") String tenantId,
      @Param("id") String id,
      @Param("cooperationTier") String cooperationTier,
      @Param("lastEvaluationScore") BigDecimal lastEvaluationScore);
}
