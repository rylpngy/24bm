package com.procurement.mall.infrastructure;

import com.procurement.mall.api.PhysicalAfterSalesContracts.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface PhysicalAfterSalesMapper {
  String COLUMNS =
      "id,after_sales_id,request_key,kind,quantity,reference_no,note,file_name,sha256,actor_id,actor_role,created_at";

  @Select(
      "select "
          + COLUMNS
          + " from mall_after_sales_physical_events where tenant_id=#{t} and after_sales_id=#{id}"
          + " order by created_at,id")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  List<Event> events(@Param("t") String t, @Param("id") String id);

  @Insert(
      "insert into"
          + " mall_after_sales_physical_events(id,tenant_id,after_sales_id,request_key,kind,quantity,reference_no,note,file_name,file_bytes,sha256,actor_id,actor_role)"
          + " values(#{id},#{tenant},#{caseId},#{key},#{kind},#{quantity},#{reference},#{note},#{name},#{bytes},#{sha},#{actor},#{role})")
  void insert(Map<String, Object> values);

  @Select(
      "select file_bytes as bytes,file_name,sha256 from mall_after_sales_physical_events where"
          + " tenant_id=#{t} and after_sales_id=#{id} and id=#{event}")
  File file(@Param("t") String t, @Param("id") String id, @Param("event") String event);

  @Select(
      "select exists(select 1 from order_settlements where tenant_id=#{t} and order_id=#{o} and"
          + " status not in ('rejected','withdrawn'))")
  boolean settlementLocked(@Param("t") String t, @Param("o") String o);

  @Select(
      "select exists(select 1 from procurement_execution_archives a join purchase_orders o on"
          + " o.tenant_id=a.tenant_id and o.rfq_id=a.rfq_id where o.tenant_id=#{t} and o.id=#{o})")
  boolean archived(@Param("t") String t, @Param("o") String o);

  @Select(
      "select coalesce(sum(r.received_quantity),0) from receipt_line_items r where r.tenant_id=#{t}"
          + " and r.order_line_id=#{line}")
  java.math.BigDecimal received(@Param("t") String t, @Param("line") String line);
}
