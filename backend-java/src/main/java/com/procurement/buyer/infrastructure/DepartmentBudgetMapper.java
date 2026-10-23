package com.procurement.buyer.infrastructure;

import com.procurement.buyer.domain.DepartmentBudget;
import com.procurement.identity.domain.DataScope;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface DepartmentBudgetMapper {

  // 预算 + 部门名 + 占用(已通过=已用,审批中=在途;按需求创建年份匹配期间)。
  String BUDGET_SELECT =
      """
      select b.id as id,
             b.department_id as department_id,
             coalesce(d.name, b.department_id) as department_name,
             b.period as period,
             b.total_amount as total_amount,
             coalesce((select sum(pd.budget) from purchase_demands pd
                       where pd.tenant_id = b.tenant_id and pd.department_id = b.department_id
                         and pd.status = '已通过' and to_char(pd.created_at, 'YYYY') = b.period), 0)
               as committed,
             coalesce((select sum(pd.budget) from purchase_demands pd
                       where pd.tenant_id = b.tenant_id and pd.department_id = b.department_id
                         and pd.status = '审批中' and to_char(pd.created_at, 'YYYY') = b.period), 0)
               as pending,
             coalesce((select sum(m.amount) from contract_payment_milestones m
                       join contracts c on c.id = m.contract_id and c.tenant_id = m.tenant_id
                       join purchase_orders po on po.id = c.related_order_id and po.tenant_id = c.tenant_id
                       where m.tenant_id = b.tenant_id and m.status = '已付'
                         and exists (select 1 from rfq_demands rd
                           join purchase_demands pd on pd.id = rd.demand_id and pd.tenant_id = rd.tenant_id
                           where rd.rfq_id = po.rfq_id and rd.tenant_id = po.tenant_id
                             and pd.department_id = b.department_id and to_char(pd.created_at, 'YYYY') = b.period)
                         and not exists (select 1 from rfq_demands rd
                           left join purchase_demands pd on pd.id = rd.demand_id and pd.tenant_id = rd.tenant_id
                           where rd.rfq_id = po.rfq_id and rd.tenant_id = po.tenant_id
                             and (pd.department_id is null or pd.department_id != b.department_id
                               or to_char(pd.created_at, 'YYYY') != b.period))), 0)
               as disbursed
      from department_budgets b
      join departments d on d.id = b.department_id and d.tenant_id = b.tenant_id
      """;

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
