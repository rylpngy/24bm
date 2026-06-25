package com.procurement.platform.infrastructure;

import com.procurement.platform.domain.BillingStatementLine;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface BillingStatementLineMapper {

  @Insert("""
      insert into billing_statement_lines
        (id, statement_id, metric, label, included_quota, used, overage,
         overage_unit_price, overage_cost, sort_no)
      values
        (#{id}, #{statementId}, #{metric}, #{label}, #{includedQuota}, #{used}, #{overage},
         #{overageUnitPrice}, #{overageCost}, #{sortNo})
      """)
  void insert(
      @Param("id") String id,
      @Param("statementId") String statementId,
      @Param("metric") String metric,
      @Param("label") String label,
      @Param("includedQuota") int includedQuota,
      @Param("used") int used,
      @Param("overage") int overage,
      @Param("overageUnitPrice") BigDecimal overageUnitPrice,
      @Param("overageCost") BigDecimal overageCost,
      @Param("sortNo") int sortNo);

  @Select("""
      select id, statement_id, metric, label, included_quota, used, overage,
             overage_unit_price, overage_cost, sort_no
      from billing_statement_lines
      where statement_id = #{statementId}
      order by sort_no asc
      """)
  List<BillingStatementLine> listByStatement(@Param("statementId") String statementId);
}
