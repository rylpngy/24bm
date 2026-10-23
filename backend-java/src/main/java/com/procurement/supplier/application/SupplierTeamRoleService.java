package com.procurement.supplier.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.SupplierTeamRoleModels.*;
import com.procurement.supplier.infrastructure.SupplierTeamRoleMapper;
import com.procurement.supplier.infrastructure.SupplierUserMapper;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierTeamRoleService {
  private final SupplierTeamRoleMapper roles;
  private final SupplierUserMapper users;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  private final ObjectMapper json;
  public SupplierTeamRoleService(SupplierTeamRoleMapper roles,SupplierUserMapper users,PermissionService permissions,AuditLogApplicationService audit,ObjectMapper json) {
    this.roles=roles;this.users=users;this.permissions=permissions;this.audit=audit;this.json=json;
  }
  private static final List<Permission> CATALOG = catalog();
  private static List<Permission> catalog() {
    List<Permission> result=new ArrayList<>();
    String[][] modules={{"rfq","询报价"},{"tender","招标项目"},{"order","订单"},{"delivery","发货"},{"invoice","发票对账"},{"mall","商品"},{"profile","企业档案与整改"},{"qualification","资质"},{"notification","站内通知"}};
    for(var module:modules){result.add(new Permission("supplier:"+module[0]+":read",module[1]+"查看"));result.add(new Permission("supplier:"+module[0]+":manage",module[1]+"办理"));}
    result.add(new Permission("supplier:announcement:read","公告查看"));
    result.add(new Permission("supplier:esign:read","签署记录查看"));
    return List.copyOf(result);
  }
  private String scope(boolean lock) {
    String id=TenantAccessGuard.requireSupplierId("supplier team roles");
    permissions.require("supplier:*");
    if(lock){users.lockSupplier(id);permissions.require("supplier:*");}
    return id;
  }
  public Workspace list() {
    String supplier=scope(false);
    var assignments=new LinkedHashMap<String,List<String>>();
    for(var grant:roles.grants(supplier))assignments.computeIfAbsent(grant.userId(),k->new ArrayList<>()).add(grant.roleId());
    return new Workspace(roles.list(supplier).stream().map(this::response).toList(),CATALOG,
        assignments.entrySet().stream().map(e->new Assignment(e.getKey(),List.copyOf(e.getValue()))).toList());
  }
  @Transactional public Role create(Save request) {
    String supplier=scope(true),id="supplier-role-"+UUID.randomUUID();
    Role role=validated(id,request);
    if(roles.duplicate(supplier,role.name(),id))throw new IllegalArgumentException("角色名称已存在");
    roles.insert(id,supplier,role.name(),encode(role.permissions()));
    audit.recordTenantAction(null,"supplier_role.created","supplier_role",id,encode(Map.of("supplierId",supplier,"after",role)));
    return role;
  }
  @Transactional public Role update(String id,Save request) {
    String supplier=scope(true);
    var old=roles.list(supplier).stream().filter(r->r.id().equals(id)&&supplier.equals(r.supplierId())).findFirst()
        .orElseThrow(()->new IllegalArgumentException("只能修改本企业自定义角色，系统角色不可修改"));
    Role role=validated(id,request);
    if(roles.duplicate(supplier,role.name(),id))throw new IllegalArgumentException("角色名称已存在");
    roles.update(id,supplier,role.name(),encode(role.permissions()));
    roles.invalidateRoleSessions(supplier,id);
    audit.recordTenantAction(null,"supplier_role.updated","supplier_role",id,encode(Map.of("supplierId",supplier,"before",response(old),"after",role)));
    return role;
  }
  @Transactional public Assignment assign(String userId,Assign request) {
    String supplier=scope(true);
    if(!users.existsBySupplierAndId(supplier,userId))throw new IllegalArgumentException("成员不属于当前企业");
    if(userId.equals(TenantAccessGuard.requireUserId("supplier team roles")))throw new IllegalArgumentException("不能修改当前登录账号的角色");
    if(request.roleIds()==null||request.roleIds().isEmpty()||request.roleIds().size()>20||request.roleIds().stream().anyMatch(Objects::isNull))throw new IllegalArgumentException("请选择1至20个角色");
    var selected=request.roleIds().stream().distinct().sorted().toList();
    var available=roles.list(supplier).stream().map(SupplierTeamRoleMapper.Row::id).toList();
    if(!available.containsAll(selected))throw new IllegalArgumentException("包含不可分配或其他企业的角色");
    if(!selected.contains("role-system-supplier-owner")&&users.countOtherActiveAdmins(supplier,userId)==0)throw new IllegalArgumentException("必须保留至少一名启用的管理员");
    var before=roles.grants(supplier).stream().filter(g->g.userId().equals(userId)).map(SupplierTeamRoleMapper.Grant::roleId).toList();
    users.clearUserRoles(supplier,userId);
    selected.forEach(id->users.assignRole(userId,id));
    users.invalidateSessions(supplier,userId);
    audit.recordTenantAction(null,"supplier_user.roles_changed","supplier_user",userId,encode(Map.of("supplierId",supplier,"before",before,"after",selected)));
    return new Assignment(userId,selected);
  }
  private Role validated(String id,Save request) {
    if(request.name()==null||request.name().isBlank()||request.name().trim().length()>80)throw new IllegalArgumentException("角色名称为1至80字");
    if(request.permissions()==null||request.permissions().isEmpty()||request.permissions().size()>40)throw new IllegalArgumentException("请选择业务权限");
    var allowed=CATALOG.stream().map(Permission::code).toList();
    if(!allowed.containsAll(request.permissions()))throw new IllegalArgumentException("包含不允许授予的权限");
    var grants=new TreeSet<>(request.permissions());
    for(String permission:request.permissions())if(permission.endsWith(":manage"))grants.add(permission.substring(0,permission.length()-6)+"read");
    return new Role(id,request.name().trim(),List.copyOf(grants),false);
  }
  private Role response(SupplierTeamRoleMapper.Row row) {
    try{return new Role(row.id(),row.name(),json.readValue(row.permissionsJson(),new TypeReference<List<String>>(){}),row.supplierId()==null);}
    catch(Exception e){throw new IllegalStateException("角色权限数据无效",e);}
  }
  private String encode(Object value) {
    try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException("角色数据编码失败",e);}
  }
}
