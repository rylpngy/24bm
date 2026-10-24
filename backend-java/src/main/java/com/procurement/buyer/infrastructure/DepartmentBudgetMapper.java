package com.procurement.buyer.infrastructure;

import com.procurement.buyer.domain.DepartmentBudget;
import com.procurement.identity.domain.DataScope;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Arg;
import org.apache.ibatis.annotations.ConstructorArgs;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.ResultMap;

@Mapper
public interface DepartmentBudgetMapper {

  // 实付仅用有正负号的付款流水净额；按需求预算占比分摊，固定排序末部门/年度承接分差。
  // 任一需求预算非正或缺失时整项目待分摊，相关净额在各涉及部门重复展示，不可相加。
  String BUDGET_SELECT =
      """
      with paid_rfq as (
        select po.tenant_id, po.rfq_id, sum(pe.amount) as amount
        from invoice_payment_entries pe
        join invoices i on i.id = pe.invoice_id and i.tenant_id = pe.tenant_id
        join purchase_orders po on po.id = i.order_id and po.tenant_id = i.tenant_id
        group by po.tenant_id, po.rfq_id
      ), unverified_rfqs as (
        select po.tenant_id, po.rfq_id, count(*) as invoice_count
        from invoices i
        join purchase_orders po on po.id = i.order_id and po.tenant_id = i.tenant_id
        where i.payment_status in ('已付款', '部分付款')
          and not exists (select 1 from invoice_payment_entries pe
                          where pe.tenant_id = i.tenant_id and pe.invoice_id = i.id)
        group by po.tenant_id, po.rfq_id
      ), demand_weights as (
        select rd.tenant_id, rd.rfq_id, pd.department_id, to_char(pd.created_at at time zone 'Asia/Shanghai', 'YYYY') as period,
               sum(pd.budget) as weight,
               bool_and(pd.id is not null and pd.department_id is not null and pd.created_at is not null
                        and pd.budget is not null and pd.budget > 0) as valid
        from rfq_demands rd
        left join purchase_demands pd on pd.id = rd.demand_id and pd.tenant_id = rd.tenant_id
        group by rd.tenant_id, rd.rfq_id, pd.department_id, to_char(pd.created_at at time zone 'Asia/Shanghai', 'YYYY')
      ), ranked_weights as (
        select w.*, p.amount, sum(w.weight) over project as total_weight,
               bool_and(w.valid) over project as all_valid,
               row_number() over (partition by w.tenant_id, w.rfq_id order by w.department_id, w.period) as rn,
               count(*) over project as cnt
        from demand_weights w join paid_rfq p on p.tenant_id = w.tenant_id and p.rfq_id = w.rfq_id
        window project as (partition by w.tenant_id, w.rfq_id)
      ), allocated_payments as (
        select r.*,
          case when all_valid and total_weight > 0 then
            case when rn = cnt then amount - sum(
              case when rn != cnt then round(amount * weight / nullif(total_weight, 0), 2) else 0 end
            ) over (partition by tenant_id, rfq_id)
            else round(amount * weight / nullif(total_weight, 0), 2) end
          else null end as allocated_amount
        from ranked_weights r
      )
      select b.id as id,
             b.department_id as department_id,
             coalesce(d.name, b.department_id) as department_name,
             b.period as period,
             b.total_amount as total_amount,
             coalesce((select sum(pd.budget) from purchase_demands pd
                       where pd.tenant_id = b.tenant_id and pd.department_id = b.department_id
                         and pd.status = '已通过' and to_char(pd.created_at at time zone 'Asia/Shanghai', 'YYYY') = b.period), 0)
               as committed,
             coalesce((select sum(pd.budget) from purchase_demands pd
                       where pd.tenant_id = b.tenant_id and pd.department_id = b.department_id
                         and pd.status = '审批中' and to_char(pd.created_at at time zone 'Asia/Shanghai', 'YYYY') = b.period), 0)
               as pending,
             case when exists (
               select 1 from unverified_rfqs u join demand_weights w
                 on w.tenant_id = u.tenant_id and w.rfq_id = u.rfq_id
               where w.tenant_id = b.tenant_id and w.department_id = b.department_id and w.period = b.period
             ) then null else
             (select case when bool_or(a.allocated_amount is null and a.amount != 0) then null
                          else coalesce(sum(a.allocated_amount), 0) end
                from allocated_payments a where a.tenant_id = b.tenant_id
                  and a.department_id = b.department_id and a.period = b.period) end as disbursed,
             (select coalesce(sum(a.amount) filter (where a.allocated_amount is null), 0)
                from allocated_payments a where a.tenant_id = b.tenant_id
                  and a.department_id = b.department_id and a.period = b.period) as pending_allocation_amount,
             (select coalesce(sum(u.invoice_count), 0) from unverified_rfqs u join demand_weights w
                on w.tenant_id = u.tenant_id and w.rfq_id = u.rfq_id
               where w.tenant_id = b.tenant_id and w.department_id = b.department_id and w.period = b.period)
               as unverified_payment_count
      from department_budgets b
      join departments d on d.id = b.department_id and d.tenant_id = b.tenant_id
      """;

  @Results(id = "departmentBudget")
  @ConstructorArgs({
      @Arg(column = "id", javaType = String.class),
      @Arg(column = "department_id", javaType = String.class),
      @Arg(column = "department_name", javaType = String.class),
      @Arg(column = "period", javaType = String.class),
      @Arg(column = "total_amount", javaType = BigDecimal.class),
      @Arg(column = "committed", javaType = BigDecimal.class),
      @Arg(column = "pending", javaType = BigDecimal.class),
      @Arg(column = "disbursed", javaType = BigDecimal.class),
      @Arg(column = "pending_allocation_amount", javaType = BigDecimal.class),
      @Arg(column = "unverified_payment_count", javaType = Long.class)
  })
  @Select("<script>" + BUDGET_SELECT + """
       where b.tenant_id = #{tenantId}
       <if test="scope.restricted">
         <choose>
           <when test="scope.requesterId == null and scope.departmentIds != null and !scope.departmentIds.isEmpty()">
             and b.department_id in
             <foreach collection="scope.departmentIds" item="dept" open="(" separator="," close=")">#{dept}</foreach>
           </when>
           <otherwise>and false</otherwise>
         </choose>
       </if>
       order by b.period desc, b.department_id</script>
      """)
  List<DepartmentBudget> listByTenant(@Param("tenantId") String tenantId, @Param("scope") DataScope scope);

  @Select("select exists(select 1 from departments where tenant_id = #{tenantId} and id = #{departmentId} and status = 'active')")
  boolean activeDepartmentExists(@Param("tenantId") String tenantId, @Param("departmentId") String departmentId);

  @Select(BUDGET_SELECT + " where b.tenant_id = #{tenantId} and b.id = #{id}")
  @ResultMap("departmentBudget")
  DepartmentBudget findByTenantAndId(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into department_budgets (id, tenant_id, department_id, period, total_amount)
      values (#{id}, #{tenantId}, #{departmentId}, #{period}, #{totalAmount})
      on conflict (tenant_id, department_id, period) do update
        set total_amount = excluded.total_amount, updated_at = now()
      """)
  void upsert(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("departmentId") String departmentId,
      @Param("period") String period,
      @Param("totalAmount") BigDecimal totalAmount);

  @Select("""
      select id from department_budgets
      where tenant_id = #{tenantId} and department_id = #{departmentId} and period = #{period}
      """)
  String findId(
      @Param("tenantId") String tenantId,
      @Param("departmentId") String departmentId,
      @Param("period") String period);
}
