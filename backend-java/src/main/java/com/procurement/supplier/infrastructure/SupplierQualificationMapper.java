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
  @Select("select pg_advisory_xact_lock(hashtextextended('supplier-qualification:' || #{supplier},0))")
  @org.apache.ibatis.annotations.Options(useCache=false,flushCache=org.apache.ibatis.annotations.Options.FlushCachePolicy.TRUE)
  String lockSupplier(String supplier);
  @Update("update supplier_qualification_reviews set status='superseded' where qualification_id=#{previousId} and status='pending'")
  void supersedeReviews(String previousId);

  @Update("update qualification_supplement_requests set status='returned',revision=revision+1 where replacement_id=#{previousId} and status='submitted'")
  void returnSupersededSupplements(String previousId);

  @Insert("insert into supplier_qualification_reviews(relation_id,qualification_id,previous_id) select id,#{id},#{previousId} from buyer_supplier_relations where supplier_id=#{supplierId}")
  void enqueueReviews(String supplierId, String id, String previousId);

  @Select("""
      <script>
      select v.id,v.relation_id,v.qualification_id,v.previous_id,q.qualification_type,e.name as supplier_name,t.name as tenant_name,
             v.status,v.comment,v.actor_id,v.created_at,v.reviewed_at
      from supplier_qualification_reviews v
      join buyer_supplier_relations r on r.id=v.relation_id
      join supplier_qualifications q on q.id=v.qualification_id
      join enterprises e on e.id=r.supplier_id
      join tenants t on t.id=r.tenant_id
      where 1=1
      <if test="tenantId != null">and r.tenant_id=#{tenantId}</if>
      <if test="supplierId != null">and r.supplier_id=#{supplierId}</if>
      order by v.created_at desc,v.id desc
      </script>
      """)
  List<com.procurement.supplier.api.QualificationReviewResponse> reviews(String tenantId, String supplierId);

  @Select("select q.supplier_id from supplier_qualification_reviews v join buyer_supplier_relations r on r.id=v.relation_id join supplier_qualifications q on q.id=v.qualification_id where v.id=#{id} and r.tenant_id=#{tenantId}")
  String reviewSupplier(String tenantId, long id);

  @Select("select v.qualification_id from supplier_qualification_reviews v join buyer_supplier_relations r on r.id=v.relation_id where v.id=#{id} and r.tenant_id=#{tenantId}")
  String reviewQualification(String tenantId, long id);

  @Update("""
      update supplier_qualification_reviews v set status=#{status},comment=#{comment},actor_id=#{actorId},reviewed_at=now()
      from buyer_supplier_relations r
      where r.id=v.relation_id and r.tenant_id=#{tenantId} and v.id=#{id} and v.status='pending'
      """)
  int decideReview(String tenantId, long id, String status, String comment, String actorId);

  @Select("select count(*) from supplier_qualification_reviews where relation_id=#{relationId} and status in ('pending','rejected') and qualification_id in (select id from supplier_qualifications where replaced_by is null)")
  int blockingReviews(String relationId);

  @Insert("insert into supplier_qualification_uploads(storage_key,supplier_id,file_name,expires_at) values(#{key},#{supplierId},#{fileName},now()+interval '15 minutes')")
  void issueUpload(String key, String supplierId, String fileName);

  @Update("update supplier_qualification_uploads set state='uploading' where storage_key=#{key} and supplier_id=#{supplierId} and state='issued' and expires_at>now()")
  int claimUpload(String key, String supplierId);

  @Update("update supplier_qualification_uploads set state='uploaded',content_sha256=#{hash},content_size=#{size} where storage_key=#{key} and supplier_id=#{supplierId} and state='uploading'")
  int finishUpload(String key, String supplierId, String hash, long size);

  @Update("update supplier_qualification_uploads set state='registered' where storage_key=#{key} and supplier_id=#{supplierId} and file_name=#{fileName} and state='uploaded'")
  int registerUpload(String key, String supplierId, String fileName);

  @Select("select content_sha256 from supplier_qualification_uploads where storage_key=#{key} and state in ('uploaded','registered')")
  String originalHash(String key);

  @Update("update supplier_qualifications set status='inactive',replaced_by=#{replacementId} where supplier_id=#{supplierId} and id=#{id} and replaced_by is null")
  int replace(String supplierId, String id, String replacementId);

  @Insert("insert into supplier_qualification_events(supplier_id,qualification_id,replacement_id,action,actor_id) values(#{supplierId},#{id},#{replacementId},#{action},#{actorId})")
  void recordEvent(String supplierId, String id, String replacementId, String action, String actorId);

  @Select("select id,supplier_id,qualification_type,certificate_no,expires_at,file_name,storage_key,status,created_at from supplier_qualifications where supplier_id=#{supplierId} and id=#{id} for update")
  SupplierQualification lockQualification(String supplierId, String id);

  @Select("select replaced_by from supplier_qualifications where supplier_id=#{supplierId} and id=#{id}")
  String replacement(String supplierId, String id);

  @Select("select qualification_id as \"qualificationId\", replacement_id as \"replacementId\", action, actor_id as \"actorId\", created_at as \"createdAt\" from supplier_qualification_events where supplier_id=#{supplierId} order by created_at desc,id desc limit 100")
  List<java.util.Map<String, Object>> history(String supplierId);

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
        <if test="status != 'all'">
        and status = #{status,jdbcType=VARCHAR}
        </if>
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
