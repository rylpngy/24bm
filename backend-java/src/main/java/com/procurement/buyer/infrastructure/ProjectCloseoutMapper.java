package com.procurement.buyer.infrastructure;

import com.procurement.buyer.api.ProjectCloseoutContracts.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ProjectCloseoutMapper {
  @Insert(
      "insert into"
          + " procurement_project_adjustments(id,tenant_id,project_id,package_id,action,reason,snapshot,released_amount,actor_id)"
          + " values(#{id},#{t},#{p},#{lot,jdbcType=VARCHAR},#{action},#{reason},cast(#{snapshot}"
          + " as jsonb),#{released},#{actor})")
  void event(
      @Param("id") String id,
      @Param("t") String t,
      @Param("p") String p,
      @Param("lot") String lot,
      @Param("action") String action,
      @Param("reason") String reason,
      @Param("snapshot") String snapshot,
      @Param("released") BigDecimal released,
      @Param("actor") String actor);

  @Select(
      "select"
          + " id,project_id,package_id,action,reason,snapshot::text,released_amount,actor_id,created_at,coalesce((select"
          + " u.name from users u where u.id=procurement_project_adjustments.actor_id and"
          + " u.tenant_id=procurement_project_adjustments.tenant_id),actor_id) actor_name from"
          + " procurement_project_adjustments where tenant_id=#{t} and project_id=#{p} order by"
          + " created_at,id")
  List<Adjustment> history(@Param("t") String t, @Param("p") String p);

  @Select(
      "select count(*) from procurement_project_adjustments where tenant_id=#{t} and"
          + " project_id=#{p}")
  long countHistory(@Param("t") String t, @Param("p") String p);

  @Select(
      "select"
          + " id,project_id,package_id,action,reason,snapshot::text,released_amount,actor_id,created_at,coalesce((select"
          + " u.name from users u where u.id=procurement_project_adjustments.actor_id and"
          + " u.tenant_id=procurement_project_adjustments.tenant_id),actor_id) actor_name from"
          + " procurement_project_adjustments where tenant_id=#{t} and project_id=#{p} order by"
          + " created_at desc,id limit #{size} offset #{offset}")
  List<Adjustment> pageHistory(
      @Param("t") String t,
      @Param("p") String p,
      @Param("size") int size,
      @Param("offset") long offset);

  @Select(
      "select due_date from procurement_project_milestones where tenant_id=#{t} and"
          + " package_id=#{lot} and milestone=#{key}")
  LocalDate due(@Param("t") String t, @Param("lot") String lot, @Param("key") String key);

  @Insert(
      "insert into"
          + " procurement_project_milestones(tenant_id,project_id,package_id,milestone,due_date,updated_by)"
          + " values(#{t},#{p},#{lot},#{key},#{due},#{actor}) on"
          + " conflict(tenant_id,package_id,milestone) do update set"
          + " due_date=excluded.due_date,updated_by=excluded.updated_by,updated_at=now()")
  void plan(
      @Param("t") String t,
      @Param("p") String p,
      @Param("lot") String lot,
      @Param("key") String key,
      @Param("due") LocalDate due,
      @Param("actor") String actor);
}
