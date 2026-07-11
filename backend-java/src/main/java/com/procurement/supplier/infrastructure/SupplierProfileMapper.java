package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.SupplierProfile;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface SupplierProfileMapper {

  @Select("""
      select e.id,
             e.name,
             e.type,
             e.industry,
             e.verified,
             s.credit_code,
             s.legal_person,
             s.verified_status,
             s.profile_status
      from enterprises e
      left join supplier_enterprises s on s.enterprise_id = e.id
      where e.id = #{supplierId} and e.type = 'supplier'
      """)
  SupplierProfile findBySupplierId(@Param("supplierId") String supplierId);

  @Update("""
      update enterprises
      set name = #{name},
          industry = #{industry},
          updated_at = now()
      where id = #{supplierId}
        and type = 'supplier'
      """)
  void updateEnterpriseProfile(
      @Param("supplierId") String supplierId,
      @Param("name") String name,
      @Param("industry") String industry);

  @Update("""
      update supplier_enterprises
      set credit_code = #{creditCode},
          legal_person = #{legalPerson}
      where enterprise_id = #{supplierId}
      """)
  void updateSupplierEnterpriseProfile(
      @Param("supplierId") String supplierId,
      @Param("creditCode") String creditCode,
      @Param("legalPerson") String legalPerson);

  // 采购方建档:登记时补全供应商主数据(仅覆盖非空传入值的语义由应用层保证)。
  @Update("""
      update supplier_enterprises
      set credit_code = case when #{creditCode} is null or #{creditCode} = '' then credit_code else #{creditCode} end,
          legal_person = case when #{legalPerson} is null or #{legalPerson} = '' then legal_person else #{legalPerson} end,
          contact_name = case when #{contactName} is null or #{contactName} = '' then contact_name else #{contactName} end,
          contact_phone = case when #{contactPhone} is null or #{contactPhone} = '' then contact_phone else #{contactPhone} end,
          contact_email = case when #{contactEmail} is null or #{contactEmail} = '' then contact_email else #{contactEmail} end,
          business_scope = case when #{businessScope} is null or #{businessScope} = '' then business_scope else #{businessScope} end,
          bank_name = case when #{bankName} is null or #{bankName} = '' then bank_name else #{bankName} end,
          bank_account = case when #{bankAccount} is null or #{bankAccount} = '' then bank_account else #{bankAccount} end
      where enterprise_id = #{supplierId}
      """)
  int updateSupplierMasterData(
      @Param("supplierId") String supplierId,
      @Param("creditCode") String creditCode,
      @Param("legalPerson") String legalPerson,
      @Param("contactName") String contactName,
      @Param("contactPhone") String contactPhone,
      @Param("contactEmail") String contactEmail,
      @Param("businessScope") String businessScope,
      @Param("bankName") String bankName,
      @Param("bankAccount") String bankAccount);

  @Select("""
      select t.name
      from buyer_supplier_relations r
      join tenants t on t.id = r.tenant_id
      where r.supplier_id = #{supplierId}
        and r.status = '已准入'
      order by t.name
      """)
  List<String> listConnectedBuyerNames(@Param("supplierId") String supplierId);

  // 寻源发现:平台上 type=supplier 且尚未进入本租户私域库的供应商企业(可按名称/行业搜索)。
  @Select("""
      select e.id,
             e.name,
             e.type,
             e.industry,
             e.verified,
             s.credit_code,
             s.legal_person,
             s.verified_status,
             s.profile_status
      from enterprises e
      left join supplier_enterprises s on s.enterprise_id = e.id
      where e.type = 'supplier'
        and e.id not in (
          select r.supplier_id from buyer_supplier_relations r where r.tenant_id = #{tenantId}
        )
        and (#{keyword,jdbcType=VARCHAR} is null
             or e.name ilike '%' || #{keyword,jdbcType=VARCHAR} || '%'
             or coalesce(e.industry, '') ilike '%' || #{keyword,jdbcType=VARCHAR} || '%')
      order by e.name
      """)
  List<SupplierProfile> discoverForTenant(
      @Param("tenantId") String tenantId, @Param("keyword") String keyword);
}
