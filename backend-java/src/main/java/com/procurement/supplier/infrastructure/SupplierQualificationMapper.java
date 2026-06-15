package com.procurement.supplier.infrastructure;

import com.procurement.supplier.domain.SupplierQualification;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SupplierQualificationMapper {

  @Select("""
      select id, supplier_id, qualification_type, certificate_no, expires_at,
             file_name, storage_key, status, created_at
      from supplier_qualifications
      where supplier_id = #{supplierId}
        and status = 'active'
      order by created_at desc
      """)
  @Results(id = "supplierQualificationResults", value = {
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "qualification_type", property = "qualificationType"),
      @Result(column = "certificate_no", property = "certificateNo"),
      @Result(column = "expires_at", property = "expiresAt"),
      @Result(column = "file_name", property = "fileName"),
      @Result(column = "storage_key", property = "storageKey"),
      @Result(column = "created_at", property = "createdAt")
  })
  List<SupplierQualification> listActiveBySupplier(@Param("supplierId") String supplierId);

  @Select("""
      select id, supplier_id, qualification_type, certificate_no, expires_at,
             file_name, storage_key, status, created_at
      from supplier_qualifications
      where supplier_id = #{supplierId}
        and id = #{id}
      """)
  @Results(id = "singleSupplierQualificationResults", value = {
      @Result(column = "supplier_id", property = "supplierId"),
      @Result(column = "qualification_type", property = "qualificationType"),
      @Result(column = "certificate_no", property = "certificateNo"),
      @Result(column = "expires_at", property = "expiresAt"),
      @Result(column = "file_name", property = "fileName"),
      @Result(column = "storage_key", property = "storageKey"),
      @Result(column = "created_at", property = "createdAt")
  })
  SupplierQualification findBySupplierAndId(
      @Param("supplierId") String supplierId,
      @Param("id") String id);

  @Insert("""
      insert into supplier_qualifications (
        id, supplier_id, qualification_type, certificate_no, expires_at, file_name, storage_key, status
      )
      values (
        #{id}, #{supplierId}, #{qualificationType}, #{certificateNo}, #{expiresAt}, #{fileName}, #{storageKey}, #{status}
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
}
