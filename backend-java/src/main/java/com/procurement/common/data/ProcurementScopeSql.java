package com.procurement.common.data;

/** Shared record visibility for order reads, financial reports and procurement aggregates. */
public final class ProcurementScopeSql {
  private ProcurementScopeSql() {}

  // A merged RFQ is indivisible: every linked demand must belong to an allowed department.
  public static final String RFQS = """
      select r.id from rfqs r where r.tenant_id = #{tenantId}
      <if test="scope.restricted">
        <choose>
          <when test="scope.requesterId != null">and r.owner_id = #{scope.requesterId}</when>
          <when test="scope.departmentIds != null and !scope.departmentIds.isEmpty()">
            and ((exists (select 1 from rfq_demands rd
              where rd.tenant_id = r.tenant_id and rd.rfq_id = r.id)
            and not exists (select 1 from rfq_demands rd
              left join purchase_demands d on d.tenant_id = rd.tenant_id and d.id = rd.demand_id
              where rd.tenant_id = r.tenant_id and rd.rfq_id = r.id
                and (d.department_id is null or d.department_id not in
                  <foreach collection="scope.departmentIds" item="dept" open="(" separator="," close=")">#{dept}</foreach>)))
              or (r.method in ('商城', '招标')
                and not exists (select 1 from rfq_demands rd where rd.tenant_id = r.tenant_id and rd.rfq_id = r.id)
                and exists (select 1 from users owner_user where owner_user.id = r.owner_id
                  and owner_user.tenant_id = r.tenant_id and owner_user.department_id in
                  <foreach collection="scope.departmentIds" item="dept" open="(" separator="," close=")">#{dept}</foreach>)))
          </when>
          <otherwise>and false</otherwise>
        </choose>
      </if>
      """;

  public static final String ORDERS = "select scope_po.id from purchase_orders scope_po where scope_po.tenant_id = #{tenantId}"
      + " <if test=\"scope.restricted\">and scope_po.rfq_id in (" + RFQS + ")</if>";
}
