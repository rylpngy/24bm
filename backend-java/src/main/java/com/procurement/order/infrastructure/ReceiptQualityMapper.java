package com.procurement.order.infrastructure;

import com.procurement.order.api.ReceiptQualityContracts.*;
import java.util.*;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ReceiptQualityMapper {
  @Select(
      "select"
          + " q.receipt_line_id,q.order_line_id,l.description,q.received_quantity,q.qualified_quantity,q.returned_quantity,q.exchanged_quantity,q.unresolved_quantity,q.valid"
          + " from receipt_after_sales_line_clearance q join receipt_line_items l on"
          + " l.tenant_id=q.tenant_id and l.id=q.receipt_line_id where q.tenant_id=#{t} and"
          + " q.receipt_id=#{r} order by q.receipt_line_id")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  List<Line> lines(@Param("t") String t, @Param("r") String r);

  @Select(
      "select a.id as after_sales_id,a.order_line_id,a.type as kind,a.quantity,e.id as"
          + " physical_event_id,e.sha256 as physical_sha256 from mall_after_sales a join"
          + " mall_after_sales_physical_checks p on p.tenant_id=a.tenant_id and p.id=a.id join"
          + " lateral(select * from mall_after_sales_physical_events e where"
          + " e.tenant_id=a.tenant_id and e.after_sales_id=a.id order by e.created_at desc,e.id"
          + " desc limit 1)e on true where a.tenant_id=#{t} and a.order_id=#{o} and p.verified and"
          + " not exists(select 1 from receipt_after_sales_resolutions q where"
          + " q.tenant_id=a.tenant_id and q.after_sales_id=a.id) order by a.id")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  List<Candidate> candidates(@Param("t") String t, @Param("o") String o);

  @Select(
      "select"
          + " q.id,q.receipt_line_id,q.after_sales_id,q.quantity,q.kind,q.physical_event_id,q.physical_sha256,e.file_name,q.reason,q.reviewed_by,q.reviewed_at"
          + " from receipt_after_sales_resolutions q join mall_after_sales_physical_events e on"
          + " e.tenant_id=q.tenant_id and e.id=q.physical_event_id where q.tenant_id=#{t} and"
          + " q.receipt_id=#{r} order by q.reviewed_at,q.id")
  @Options(useCache = false, flushCache = Options.FlushCachePolicy.TRUE)
  List<Resolution> resolutions(@Param("t") String t, @Param("r") String r);

  @Select(
      "select exists(select 1 from procurement_execution_archives where tenant_id=#{t} and"
          + " rfq_id=#{rfq}) or exists(select 1 from contracts where tenant_id=#{t} and"
          + " related_order_id=#{o} and archive_status='已归档') or exists(select 1 from"
          + " order_settlements where tenant_id=#{t} and order_id=#{o} and status not in"
          + " ('rejected','withdrawn'))")
  boolean frozen(@Param("t") String t, @Param("o") String o, @Param("rfq") String rfq);

  @Select(
      "select disposition_approved from finance_receipt_acceptance where tenant_id=#{t} and"
          + " id=#{r}")
  boolean conceded(@Param("t") String t, @Param("r") String r);

  @Insert(
      "insert into"
          + " receipt_after_sales_resolutions(id,tenant_id,receipt_id,receipt_line_id,after_sales_id,quantity,kind,physical_event_id,physical_sha256,reason,reviewed_by)"
          + " values(#{id},#{t},#{receipt},#{line},#{afterSales},#{quantity},#{kind},#{event},#{sha},#{reason},#{actor})")
  void insert(Map<String, Object> values);
}
