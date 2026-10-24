package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.supplier.api.*;
import com.procurement.supplier.application.SupplierInvitationApplicationService;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext
class CooperationInvitationIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired SupplierInvitationApplicationService service;
  String a,b,s,other,buyer,supplier,otherUser,role;
  @BeforeEach void seed() {
    String prefix = "ci-" + UUID.randomUUID();
    a=prefix+"a"; b=prefix+"b"; s=prefix+"s"; other=prefix+"o";
    buyer=prefix+"bu"; supplier=prefix+"su"; otherUser=prefix+"ou"; role=prefix+"sr";
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'采购企业A','starter','active'),(?,'采购企业B','starter','active')",a,b);
    jdbc.update("insert into enterprises(id,name,type) values (?,'真实供应商','supplier'),(?,'其他供应商','supplier'),(?,'采购企业','buyer')",s,other,prefix+"buyerEnterprise");
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'采购员','active')",buyer,a);
    jdbc.update("insert into users(id,supplier_id,name,status) values (?,?,'供应商经办人','active'),(?,?,'其他企业经办人','active')",supplier,s,otherUser,other);
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions) values (?,?,'buyer','采购员','[\"buyer:supplier:read\",\"buyer:supplier:manage\"]')",prefix+"br",a);
    jdbc.update("insert into roles(id,supplier_id,scope,name,permissions) values (?,?,'supplier','合作邀请经办','[\"supplier:profile:read\",\"supplier:profile:manage\"]')",role,s);
    jdbc.update("insert into roles(id,supplier_id,scope,name,permissions) values (?,?,'supplier','合作邀请经办','[\"supplier:profile:read\",\"supplier:profile:manage\"]')",prefix+"or",other);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?),(?,?),(?,?)",buyer,prefix+"br",supplier,role,otherUser,prefix+"or");
    buyer();
  }
  @AfterEach void clear() { TenantContext.clear(); }
  void buyer() { TenantContext.set(a,null,buyer); }
  void supplier() { TenantContext.set(null,s,supplier); }
  SupplierInvitationResponse create(String supplierId) {
    buyer();
    return service.createInvitation(new CreateSupplierInvitationRequest(supplierId,"输入名称","公开联系","设备","邀请说明"));
  }
  long relations() { return jdbc.queryForObject("select count(*) from buyer_supplier_relations where tenant_id=? and supplier_id=?",Long.class,a,s); }
  String relationStatus() { return jdbc.queryForObject("select status from buyer_supplier_relations where tenant_id=? and supplier_id=?",String.class,a,s); }

  @Test void supplierAcceptanceIsTenantScopedAuditedAndOnlyPendingAdmission() {
    var invitation=create(s);
    assertThat(invitation.supplierName()).isEqualTo("真实供应商");
    assertThat(invitation.buyerName()).isEqualTo("采购企业A");
    assertThatThrownBy(() -> service.respond(invitation.id(),new RespondSupplierInvitationRequest("accept"))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.respond(invitation.id(),new RespondSupplierInvitationRequest("decline"))).isInstanceOf(IllegalArgumentException.class);
    supplier();
    var result=service.respondSupplier(invitation.id(),new RespondSupplierInvitationRequest("accept"));
    assertThat(result.status()).isEqualTo("已接受");
    assertThat(result.respondedAt()).isNotNull();
    assertThat(relationStatus()).isEqualTo("待准入");
    assertThat(jdbc.queryForObject("select actor_id from audit_logs where tenant_id=? and target_id=? and action='supplier_invitation.accept'",String.class,a,invitation.id())).isEqualTo(supplier);
    assertThatThrownBy(() -> service.respondSupplier(invitation.id(),new RespondSupplierInvitationRequest("decline"))).isInstanceOf(IllegalStateException.class);
    assertThat(relations()).isEqualTo(1);
  }

  @Test void listingAndResponseExcludeOtherSupplierOfflineAndOtherBuyerScope() {
    var own=create(s); var foreign=create(other); var offline=create(null);
    jdbc.update("insert into supplier_invitations(id,tenant_id,supplier_id,supplier_name,status) values (?,?,?,'真实供应商','待回复')",a+"secondBuyer",b,s);
    supplier();
    assertThat(service.listSupplierInvitations()).extracting(SupplierInvitationResponse::id).containsExactlyInAnyOrder(own.id(),a+"secondBuyer");
    assertThat(service.listSupplierInvitations()).extracting(SupplierInvitationResponse::buyerName).containsExactlyInAnyOrder("采购企业A","采购企业B");
    assertThatThrownBy(() -> service.respondSupplier(foreign.id(),new RespondSupplierInvitationRequest("accept"))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.respondSupplier(offline.id(),new RespondSupplierInvitationRequest("accept"))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.respondSupplier(own.id(),new RespondSupplierInvitationRequest("withdraw"))).isInstanceOf(IllegalArgumentException.class);
    buyer();
    assertThatThrownBy(() -> service.respond(a+"secondBuyer",new RespondSupplierInvitationRequest("withdraw"))).isInstanceOf(IllegalArgumentException.class);
    service.respond(offline.id(),new RespondSupplierInvitationRequest("accept"));
    service.respond(own.id(),new RespondSupplierInvitationRequest("withdraw"));
    TenantContext.set(null,other,otherUser);
    assertThat(service.respondSupplier(foreign.id(),new RespondSupplierInvitationRequest("decline")).status()).isEqualTo("已拒绝");
    assertThat(relations()).isZero();
  }

  @Test void acceptingNeverResetsExistingAdmissionBlacklistOrExit() {
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level,categories,contact_name) values (?,?,?,'黑名单','A','[\"原品类\"]','私域联系人')",a+"rel",a,s);
    for(String status : List.of("黑名单","已退出","已准入","准入审批中")) {
      jdbc.update("update buyer_supplier_relations set status=? where id=?",status,a+"rel");
      var invitation=create(s); supplier();
      service.respondSupplier(invitation.id(),new RespondSupplierInvitationRequest("accept"));
      assertThat(relationStatus()).isEqualTo(status);
      assertThat(jdbc.queryForObject("select contact_name from buyer_supplier_relations where id=?",String.class,a+"rel")).isEqualTo("私域联系人");
      assertThat(jdbc.queryForObject("select level from buyer_supplier_relations where id=?",String.class,a+"rel")).isEqualTo("A");
    }
    assertThat(relations()).isEqualTo(1);
  }

  @Test void distinctInvitationsCanAcceptConcurrentlyWithoutDuplicateOrOverwrite() throws Exception {
    var first=create(s); var second=create(s);
    var results=race(() -> supplierRespond(first.id(),"accept"),() -> supplierRespond(second.id(),"accept"));
    assertThat(results).containsExactly(true,true);
    assertThat(relations()).isEqualTo(1);
    assertThat(relationStatus()).isEqualTo("待准入");
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where tenant_id=? and action='supplier_invitation.accept'",Long.class,a)).isEqualTo(2);
  }

  @Test void acceptAndWithdrawRaceHasExactlyOneTransitionAndAudit() throws Exception {
    var invitation=create(s);
    var results=race(() -> supplierRespond(invitation.id(),"accept"),() -> {
      buyer();
      try { service.respond(invitation.id(),new RespondSupplierInvitationRequest("withdraw")); return true; }
      catch(IllegalStateException e) { return false; }
      finally { TenantContext.clear(); }
    });
    assertThat(results.stream().filter(Boolean::booleanValue).count()).isEqualTo(1);
    String status=jdbc.queryForObject("select status from supplier_invitations where id=?",String.class,invitation.id());
    assertThat(relations()).isEqualTo(status.equals("已接受") ? 1 : 0);
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where target_id=? and action in ('supplier_invitation.accept','supplier_invitation.withdraw')",Long.class,invitation.id())).isEqualTo(1);
  }

  @Test void permissionsAndSupplierIdentityAreValidatedForDirectServiceCalls() {
    assertThatThrownBy(() -> service.createInvitation(new CreateSupplierInvitationRequest(a.replaceAll("a$","buyerEnterprise"),"伪造",null,null,null))).isInstanceOf(IllegalArgumentException.class);
    var invitation=create(s); supplier();
    jdbc.update("update roles set permissions='[\"supplier:profile:read\"]' where id=?",role);
    assertThat(service.listSupplierInvitations()).hasSize(1);
    assertThatThrownBy(() -> service.respondSupplier(invitation.id(),new RespondSupplierInvitationRequest("accept"))).isInstanceOf(PermissionDeniedException.class);
    jdbc.update("update roles set permissions='[]' where id=?",role);
    assertThatThrownBy(service::listSupplierInvitations).isInstanceOf(PermissionDeniedException.class);
    buyer();
    jdbc.update("update roles set permissions='[\"buyer:supplier:read\"]' where tenant_id=?",a);
    assertThatThrownBy(() -> service.importInvitations(new byte[0])).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> service.respond(invitation.id(),new RespondSupplierInvitationRequest("withdraw"))).isInstanceOf(PermissionDeniedException.class);
  }

  boolean supplierRespond(String id,String action) {
    supplier();
    try { service.respondSupplier(id,new RespondSupplierInvitationRequest(action)); return true; }
    catch(IllegalStateException e) { return false; }
    finally { TenantContext.clear(); }
  }
  List<Boolean> race(Callable<Boolean> first,Callable<Boolean> second) throws Exception {
    try(var pool=Executors.newFixedThreadPool(2)) {
      var ready=new CountDownLatch(2); var start=new CountDownLatch(1);
      Callable<Boolean> a=() -> { ready.countDown(); if(!start.await(10,TimeUnit.SECONDS)) throw new TimeoutException(); return first.call(); };
      Callable<Boolean> b=() -> { ready.countDown(); if(!start.await(10,TimeUnit.SECONDS)) throw new TimeoutException(); return second.call(); };
      var one=pool.submit(a); var two=pool.submit(b);
      assertThat(ready.await(10,TimeUnit.SECONDS)).isTrue(); start.countDown();
      return List.of(one.get(20,TimeUnit.SECONDS),two.get(20,TimeUnit.SECONDS));
    }
  }
}
