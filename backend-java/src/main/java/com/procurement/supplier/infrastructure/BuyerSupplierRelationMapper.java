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
  String lockRelation(@Param("tenantId") String tenantId, @Param("id") String id);

  @Select("""
      select
        (select count(*) from purchase_orders where tenant_id = #{tenantId}
          and supplier_id = #{supplierId} and status != '已收货') as unreceived_order_count,
        (select count(*) from invoices where tenant_id = #{tenantId}
          and supplier_id = #{supplierId} and payment_status != '已付款') as unpaid_invoice_count,
        (select coalesce(sum(amount), 0) from invoices where tenant_id = #{tenantId}
          and supplier_id = #{supplierId} and payment_status != '已付款') as unpaid_invoice_face_amount
      """)
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
