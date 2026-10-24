package com.procurement.identity.infrastructure;

import com.procurement.identity.api.ExternalIdentityContracts.Binding;
import java.util.List;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ExternalIdentityMapper {
  String COLUMNS="b.id,b.tenant_id,b.user_id,b.issuer,b.subject,b.enabled,b.revision,b.valid_after,b.reason,b.created_by,b.created_at,b.updated_at,u.name,u.employee_no,u.status user_status";
  @Select("select "+COLUMNS+" from external_identity_bindings b join users u on u.id=b.user_id where b.issuer=#{issuer} and b.subject=#{subject}")
  Binding resolve(@Param("issuer") String issuer,@Param("subject") String subject);
  @Select("select "+COLUMNS+" from external_identity_bindings b join users u on u.id=b.user_id where b.tenant_id=#{tenant} and b.id=#{id}")
  Binding find(@Param("tenant") String tenant,@Param("id") String id);
  @Select("select "+COLUMNS+" from external_identity_bindings b join users u on u.id=b.user_id where b.tenant_id=#{tenant} and (#{keyword}='' or strpos(lower(concat_ws(' ',u.name,u.employee_no,b.subject)),lower(#{keyword}))>0) order by b.created_at desc,b.id limit #{size} offset #{offset}")
  List<Binding> list(@Param("tenant") String tenant,@Param("keyword") String keyword,@Param("size") int size,@Param("offset") long offset);
  @Select("select count(*) from external_identity_bindings b join users u on u.id=b.user_id where b.tenant_id=#{tenant} and (#{keyword}='' or strpos(lower(concat_ws(' ',u.name,u.employee_no,b.subject)),lower(#{keyword}))>0)")
  long count(@Param("tenant") String tenant,@Param("keyword") String keyword);
  @Select("select count(*) from external_identity_bindings b join users u on u.id=b.user_id where b.tenant_id=#{tenant} and b.enabled and u.status='active'")
  long active(@Param("tenant") String tenant);
  @Insert("insert into external_identity_bindings(id,tenant_id,user_id,issuer,subject,valid_after,reason,created_by) values(#{id},#{tenant},#{user},#{issuer},#{subject},#{after},#{reason},#{actor}) on conflict(issuer,subject) do nothing")
  int insert(@Param("id") String id,@Param("tenant") String tenant,@Param("user") String user,@Param("issuer") String issuer,@Param("subject") String subject,@Param("after") long after,@Param("reason") String reason,@Param("actor") String actor);
  @Update("update external_identity_bindings set enabled=#{enabled},revision=revision+1,valid_after=#{after},reason=#{reason},updated_at=now() where tenant_id=#{tenant} and id=#{id} and revision=#{revision}")
  int change(@Param("tenant") String tenant,@Param("id") String id,@Param("enabled") boolean enabled,@Param("revision") int revision,@Param("after") long after,@Param("reason") String reason);
  @Update("update external_identity_bindings set user_id=#{user},revision=revision+1,valid_after=#{after},reason=#{reason},updated_at=now() where tenant_id=#{tenant} and id=#{id} and revision=#{revision}")
  int remap(@Param("tenant") String tenant,@Param("id") String id,@Param("user") String user,@Param("revision") int revision,@Param("after") long after,@Param("reason") String reason);
}
