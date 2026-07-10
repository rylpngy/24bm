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

  @Select("""
      <script>
      select r.id, r.tenant_id, r.supplier_id, e.name as supplier_name, r.status, r.level,
             r.categories::text as categories_json, r.performance_score,
             r.cooperation_tier, r.last_evaluation_score,
             s.credit_code, s.legal_person, s.contact_name, s.contact_phone,
             s.contact_email, s.business_scope, s.bank_name, s.bank_account
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
             s.credit_code, s.legal_person, s.contact_name, s.contact_phone,
             s.contact_email, s.business_scope, s.bank_name, s.bank_account
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
