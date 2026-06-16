package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.SupplierQualification;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface SupplierQualificationMapper {

  @Select("""
      select id, supplier_id, qualification_type, certificate_no, expires_at,
             file_name, storage_key, status, created_at
      from supplier_qualifications
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
        and status = 'active'
      order by created_at desc
      """)
  List<SupplierQualification> listActiveBySupplier(@Param("supplierId") String supplierId);

  @Select("""
      <script>
      select id, supplier_id, qualification_type, certificate_no, expires_at,
             file_name, storage_key, status, created_at
      from supplier_qualifications
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
        and status = #{status,jdbcType=VARCHAR}
        <if test="keyword != null and keyword != ''">
        and (
          qualification_type ilike concat('%', #{keyword}, '%')
          or certificate_no ilike concat('%', #{keyword}, '%')
          or file_name ilike concat('%', #{keyword}, '%')
        )
        </if>
      order by created_at desc
      </script>
      """)
  List<SupplierQualification> listBySupplierFiltered(
      @Param("supplierId") String supplierId,
      @Param("status") String status,
      @Param("keyword") String keyword);

  @Select("""
      select id, supplier_id, qualification_type, certificate_no, expires_at,
             file_name, storage_key, status, created_at
      from supplier_qualifications
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
        and id = #{id}
      """)
  SupplierQualification findBySupplierAndId(
      @Param("supplierId") String supplierId,
      @Param("id") String id);

  @Insert("""
      insert into supplier_qualifications (
        id, supplier_id, qualification_type, certificate_no, expires_at, file_name, storage_key, status
      )
      values (
        #{id}, #{supplierId}, #{qualificationType}, #{certificateNo}, #{expiresAt}, #{fileName}, #{storageKey}, #{status,jdbcType=VARCHAR}
      )
      """)
  void insert(
      @Param("id") String id,
      @Param("supplierId") String supplierId,
      @Param("qualificationType") String qualificationType,
      @Param("certificateNo") String certificateNo,
      @Param("expiresAt") LocalDate expiresAt,
      @Param("fileName") String fileName,
      @Param("storageKey") String storageKey,
      @Param("status") String status);

  @Update("""
      update supplier_qualifications
      set status = #{status,jdbcType=VARCHAR}
      where supplier_id = #{supplierId,jdbcType=VARCHAR}
        and id = #{id}
      """)
  void updateStatus(
      @Param("supplierId") String supplierId,
      @Param("id") String id,
      @Param("status") String status);
}
