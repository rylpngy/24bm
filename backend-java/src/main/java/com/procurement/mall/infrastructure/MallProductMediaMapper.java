package com.procurement.mall.infrastructure;

import java.time.OffsetDateTime;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface MallProductMediaMapper {
  record Product(String id, String supplierId, String tenantId, String scope, String status, String mainImageKey) {}
  record Upload(String storageKey, String productId, String supplierId, String userId, String fileName,
      String state, String contentType, Long contentSize, String contentSha256) {}
  record Media(String id, String storageKey, String fileName, String contentType, long contentSize,
      String contentSha256, int sortOrder, boolean main) {}

  @Select("select id,supplier_id,tenant_id,scope,status,main_image_key from mall_products where id=#{id} and supplier_id=#{supplier}")
  Product own(@Param("supplier") String supplier, @Param("id") String id);

  @Select("select id,supplier_id,tenant_id,scope,status,main_image_key from mall_products where id=#{id} and supplier_id=#{supplier} for update")
  @Options(flushCache=Options.FlushCachePolicy.TRUE, useCache=false)
  Product lockOwn(@Param("supplier") String supplier, @Param("id") String id);

  @Select("""
      select p.id,p.supplier_id,p.tenant_id,p.scope,p.status,p.main_image_key from mall_products p
      where p.id=#{id} and p.status='在架' and (p.scope='public' or (p.tenant_id=#{tenant} and exists
        (select 1 from buyer_supplier_relations r where r.tenant_id=p.tenant_id
          and r.supplier_id=p.supplier_id and r.status='已准入')))
      """)
  Product visible(@Param("tenant") String tenant, @Param("id") String id);

  @Select("select id,supplier_id,tenant_id,scope,status,main_image_key from mall_products where id=#{id} and tenant_id=#{tenant} and scope='tenant' and status='待审核'")
  Product pendingForTenant(@Param("tenant") String tenant,@Param("id") String id);

  @Select("select id,supplier_id,tenant_id,scope,status,main_image_key from mall_products where id=#{id} and scope='public' and tenant_id is null and status='待审核'")
  Product publicPending(@Param("id") String id);

  @Insert("""
      insert into mall_product_media_uploads(storage_key,product_id,supplier_id,user_id,file_name,token_hash,state,expires_at)
      values(#{key},#{product},#{supplier},#{user},#{name},#{hash},'issued',#{expires})
      """)
  void issue(@Param("key") String key,@Param("product") String product,@Param("supplier") String supplier,
      @Param("user") String user,@Param("name") String name,@Param("hash") String hash,@Param("expires") OffsetDateTime expires);

  @Select("""
      select storage_key,product_id,supplier_id,user_id,file_name,state,content_type,content_size,content_sha256
      from mall_product_media_uploads where storage_key=#{key} and product_id=#{product} and supplier_id=#{supplier} and user_id=#{user}
      """)
  Upload upload(@Param("key") String key,@Param("product") String product,@Param("supplier") String supplier,@Param("user") String user);

  @Update("""
      update mall_product_media_uploads set state='uploading' where storage_key=#{key} and product_id=#{product}
        and supplier_id=#{supplier} and user_id=#{user} and token_hash=#{hash} and state='issued' and expires_at>clock_timestamp()
      """)
  int claim(@Param("key") String key,@Param("product") String product,@Param("supplier") String supplier,@Param("user") String user,@Param("hash") String hash);

  @Update("""
      update mall_product_media_uploads set state='uploaded',content_type=#{type},content_size=#{size},content_sha256=#{hash}
      where storage_key=#{key} and product_id=#{product} and supplier_id=#{supplier} and user_id=#{user} and state='uploading'
      """)
  int uploaded(@Param("key") String key,@Param("product") String product,@Param("supplier") String supplier,
      @Param("user") String user,@Param("type") String type,@Param("size") long size,@Param("hash") String hash);

  @Update("update mall_product_media_uploads set state='failed' where storage_key=#{key} and product_id=#{product} and supplier_id=#{supplier} and user_id=#{user} and state='uploading'")
  void failed(@Param("key") String key,@Param("product") String product,@Param("supplier") String supplier,@Param("user") String user);

  @Update("""
      update mall_product_media_uploads set state='registered' where storage_key=#{key} and product_id=#{product}
        and supplier_id=#{supplier} and user_id=#{user} and state='uploaded' and expires_at>clock_timestamp()
      """)
  int consume(@Param("key") String key,@Param("product") String product,@Param("supplier") String supplier,@Param("user") String user);

  String MEDIA = """
      select m.id,m.storage_key,t.file_name,t.content_type,t.content_size,t.content_sha256,m.sort_order,
        coalesce(p.main_image_key=m.storage_key,false) as main
      from mall_product_media m join mall_products p on p.id=m.product_id
      join mall_product_media_uploads t on t.storage_key=m.storage_key and t.product_id=p.id
        and t.supplier_id=p.supplier_id and t.state='registered'
      where m.product_id=#{product}
      """;

  @Select(MEDIA + " order by main desc,m.sort_order,m.id")
  List<Media> list(@Param("product") String product);

  @Select(MEDIA + " and m.id=#{id}")
  Media media(@Param("product") String product,@Param("id") String id);

  @Insert("""
      insert into mall_product_media(id,product_id,storage_key,sort_order)
      values(#{id},#{product},#{key},coalesce((select max(sort_order)+1 from mall_product_media where product_id=#{product}),0))
      """)
  void insert(@Param("id") String id,@Param("product") String product,@Param("key") String key);

  @Update("update mall_products set main_image_key=#{key},updated_at=now() where id=#{product} and supplier_id=#{supplier}")
  void main(@Param("supplier") String supplier,@Param("product") String product,@Param("key") String key);

  @Delete("delete from mall_product_media where product_id=#{product} and id=#{id}")
  int delete(@Param("product") String product,@Param("id") String id);

  @Update("""
      update mall_products set status='草稿',updated_at=now() where id=#{product} and supplier_id=#{supplier}
      """)
  void invalidate(@Param("supplier") String supplier,@Param("product") String product);
}
