package com.procurement.tender.infrastructure;

import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface TenderDocumentReviewMapper {
  record Review(String id, String tenantId, String tenderId, String fingerprint, String status,
      String requestedBy, String completedBy, String comment, OffsetDateTime createdAt, OffsetDateTime completedAt) {}

  @Select("select * from tender_document_reviews where tenant_id=#{tenantId} and tender_id=#{tenderId} order by created_at desc,id desc")
  List<Review> list(@Param("tenantId") String tenantId, @Param("tenderId") String tenderId);

  @Select("select * from tender_document_reviews where tenant_id=#{tenantId} and id=#{id} for update")
  Review lock(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("insert into tender_document_reviews(id,tenant_id,tender_id,fingerprint,status,requested_by) values(#{id},#{tenantId},#{tenderId},#{fingerprint},'processing',#{actor})")
  void insert(@Param("id") String id,@Param("tenantId") String tenantId,@Param("tenderId") String tenderId,@Param("fingerprint") String fingerprint,@Param("actor") String actor);

  @Update("update tender_document_reviews set status=#{status},completed_by=#{actor},comment=#{comment},completed_at=now() where tenant_id=#{tenantId} and id=#{id} and status='processing'")
  int complete(@Param("tenantId") String tenantId,@Param("id") String id,@Param("status") String status,@Param("actor") String actor,@Param("comment") String comment);
}
