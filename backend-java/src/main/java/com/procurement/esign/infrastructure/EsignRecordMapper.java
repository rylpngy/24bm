package com.procurement.esign.infrastructure;

import com.procurement.esign.domain.EsignRecord;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface EsignRecordMapper {

  @Insert("""
      insert into esign_records (
        id, tenant_id, target_type, target_id, signer_scope, signer_id,
        signer_name, enterprise_id, content_digest, signature_image, remark)
      values (
        #{id}, #{tenantId}, #{targetType}, #{targetId}, #{signerScope}, #{signerId},
        #{signerName}, #{enterpriseId}, #{contentDigest}, #{signatureImage}, #{remark})
      """)
  void insert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("targetType") String targetType,
      @Param("targetId") String targetId,
      @Param("signerScope") String signerScope,
      @Param("signerId") String signerId,
      @Param("signerName") String signerName,
      @Param("enterpriseId") String enterpriseId,
      @Param("contentDigest") String contentDigest,
      @Param("signatureImage") String signatureImage,
      @Param("remark") String remark);

  @Select("""
      select id, tenant_id, target_type, target_id, signer_scope, signer_id,
             signer_name, enterprise_id, content_digest, signature_image, signed_at, remark
      from esign_records
      where tenant_id = #{tenantId} and target_type = #{targetType} and target_id = #{targetId}
      order by signed_at desc
      """)
  List<EsignRecord> listByTarget(
      @Param("tenantId") String tenantId,
      @Param("targetType") String targetType,
      @Param("targetId") String targetId);
}
