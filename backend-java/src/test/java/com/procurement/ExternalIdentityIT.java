package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.*;
import com.procurement.identity.api.ExternalIdentityContracts.*;
import com.procurement.identity.domain.*;
import com.procurement.identity.security.*;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class ExternalIdentityIT {
  @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>("postgres:16-alpine");
  static final String ISSUER="https://identity.example.edu/realms/company";
  static final RSAKey KEY;static final HttpServer SERVER;
  static {try{KEY=new RSAKeyGenerator(2048).keyID("identity-it").generate();SERVER=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);SERVER.createContext("/jwks",e->{byte[] data=new JWKSet(KEY.toPublicJWK()).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);e.getResponseHeaders().add("Content-Type","application/json");e.sendResponseHeaders(200,data.length);try(var out=e.getResponseBody()){out.write(data);}});SERVER.start();}catch(Exception e){throw new ExceptionInInitializerError(e);}}
  @DynamicPropertySource static void config(DynamicPropertyRegistry r){r.add("spring.datasource.url",DB::getJdbcUrl);r.add("spring.datasource.username",DB::getUsername);r.add("spring.datasource.password",DB::getPassword);r.add("app.seed.locations",()->"");r.add("keycloak.enabled",()->true);r.add("keycloak.issuer-uri",()->ISSUER);r.add("keycloak.audience",()->"24bid-api");r.add("keycloak.buyer-identity-mapping-required",()->true);r.add("keycloak.jwk-set-uri",()->"http://127.0.0.1:"+SERVER.getAddress().getPort()+"/jwks");}
  @AfterAll static void close(){SERVER.stop(0);}
  @Autowired JdbcTemplate jdbc;@Autowired ExternalIdentityService service;@Autowired KeycloakTokenService tokens;
  @Autowired JwtTokenService localTokens;@Autowired TestRestTemplate http;
  String tenant,other,admin,user,subject,role;
  @BeforeEach void seed(){String id=UUID.randomUUID().toString();tenant="id-"+id;other="other-"+id;admin="admin-"+id;user="member-"+id;subject="external-"+id;role="role-"+id;
    for(String t:List.of(tenant,other))jdbc.update("insert into tenants(id,name,plan,status) values (?,?,'starter','active')",t,t);
    jdbc.update("insert into roles(id,tenant_id,scope,name,permissions,data_scope) values (?,?,'buyer','管理员','[\"buyer:*\"]','all')",role,tenant);
    for(String u:List.of(admin,user)){jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,?,'active')",u,tenant,u);jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",u,role);}
    TenantContext.set(tenant,null,admin);
  }
  @AfterEach void clear(){TenantContext.clear();}
  String jwt(String sub,long issued,String issuer,String audience) throws Exception {
    var c=new JWTClaimsSet.Builder().issuer(issuer).subject(sub).audience(audience).issueTime(Date.from(Instant.ofEpochSecond(issued))).expirationTime(Date.from(Instant.now().plusSeconds(300)))
      .claim("userId",admin).claim("authScope","PLATFORM").claim("tenantId",other).claim("roles",List.of("PLATFORM_ADMIN")).build();
    var j=new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KEY.getKeyID()).build(),c);j.sign(new RSASSASigner(KEY));return j.serialize();
  }
  int status(String token,String path){HttpHeaders headers=new HttpHeaders();headers.setBearerAuth(token);return http.exchange(path,HttpMethod.GET,new HttpEntity<>(headers),String.class).getStatusCode().value();}
  @Test void realSignedTokenMapsToLocalTenantAndRolesNotForgedClaims() throws Exception {
    var binding=service.create(new Create(user,subject,"工号核对"));
    String token=jwt(subject,binding.validAfter(),ISSUER,"24bid-api");
    var p=tokens.parse(token);assertThat(p.userId()).isEqualTo(user);assertThat(p.tenantId()).isEqualTo(tenant);assertThat(p.scope()).isEqualTo(IdentityScope.BUYER);
    assertThat(status(token,"/api/v1/buyer/identity-bindings/readiness")).isEqualTo(200);
    assertThat(status(token,"/api/v1/platform/tenants")).isEqualTo(403);
    assertThat(status(jwt(subject,binding.validAfter(),"https://wrong.example.edu","24bid-api"),"/api/v1/buyer/users")).isEqualTo(401);
    assertThat(status(jwt(subject,binding.validAfter(),ISSUER,"wrong"),"/api/v1/buyer/users")).isEqualTo(401);
    assertThat(status(jwt("unmapped",Instant.now().getEpochSecond(),ISSUER,"24bid-api"),"/api/v1/buyer/users")).isEqualTo(401);
  }
  @Test void disableAndReenableRevokeExistingTokenAndLocalStopStillWins() throws Exception {
    var b=service.create(new Create(user,subject,"审核"));String old=jwt(subject,b.validAfter(),ISSUER,"24bid-api");
    var disabled=service.change(b.id(),new Change(false,b.revision(),"离岗"));assertThat(status(old,"/api/v1/buyer/users")).isEqualTo(401);
    var active=service.change(b.id(),new Change(true,disabled.revision(),"恢复"));assertThat(status(old,"/api/v1/buyer/users")).isEqualTo(401);
    String fresh=jwt(subject,active.validAfter(),ISSUER,"24bid-api");assertThat(status(fresh,"/api/v1/buyer/users")).isEqualTo(200);
    jdbc.update("update users set status='inactive' where id=?",user);assertThat(status(fresh,"/api/v1/buyer/users")).isEqualTo(401);
  }
  @Test void scopeVersionDuplicateAndSelfLockoutAreProtected(){
    var b=service.create(new Create(user,subject,"核验"));
    assertThatThrownBy(()->service.create(new Create(admin,subject,"重复"))).hasMessageContaining("已有映射");
    assertThatThrownBy(()->service.change(b.id(),new Change(false,99,"过时"))).hasMessageContaining("刷新");
    TenantContext.set(other,null,admin);assertThatThrownBy(()->service.change(b.id(),new Change(false,b.revision(),"跨企业"))).isInstanceOf(RuntimeException.class);
    TenantContext.set(tenant,null,user);assertThatThrownBy(()->service.change(b.id(),new Change(false,b.revision(),"自己"))).hasMessageContaining("自己");
    assertThat(service.list(1,10,subject).total()).isEqualTo(1);assertThat(service.list(1,10,"%_").total()).isZero();
    assertThatThrownBy(()->service.list(0,10,"")).isInstanceOf(IllegalArgumentException.class);
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where tenant_id=? and action='identity.binding_created'",Integer.class,tenant)).isEqualTo(1);
  }
  @Test void localRoleRemovalCannotBeBypassedByExternalClaims() throws Exception {
    var b=service.create(new Create(user,subject,"核验"));String token=jwt(subject,b.validAfter(),ISSUER,"24bid-api");
    jdbc.update("delete from user_roles where user_id=?",user);assertThat(status(token,"/api/v1/buyer/users")).isEqualTo(401);
    assertThatThrownBy(()->service.create(new Create(user,subject+"-new","无角色"))).hasMessageContaining("角色");
  }
  @Test void remapPreservesAuditAndInvalidatesOldToken() throws Exception {
    var b=service.create(new Create(user,subject,"核验"));String old=jwt(subject,b.validAfter(),ISSUER,"24bid-api");
    var mapped=service.remap(b.id(),new Remap(admin,b.revision(),"修正错误关联"));
    assertThat(status(old,"/api/v1/buyer/users")).isEqualTo(401);
    assertThat(tokens.parse(jwt(subject,mapped.validAfter(),ISSUER,"24bid-api")).userId()).isEqualTo(admin);
    assertThat(mapped.id()).isEqualTo(b.id());assertThat(mapped.revision()).isEqualTo(2);
    assertThat(jdbc.queryForObject("select count(*) from audit_logs where tenant_id=? and action='identity.binding_remapped'",Integer.class,tenant)).isEqualTo(1);
  }
  @Test void openApiUsesDistinctSchemaAndPagingDoesNotTruncate() throws Exception {
    for(int i=0;i<12;i++)service.create(new Create(user,subject+"-page-"+i,"分页"));
    assertThat(service.list(2,10,subject+"-page-").items()).hasSize(2);
    assertThat(service.list(2,10,subject+"-page-").total()).isEqualTo(12);
    var spec=new com.fasterxml.jackson.databind.ObjectMapper().readTree(http.getForObject("/v3/api-docs",String.class));
    assertThat(spec.at("/paths/~1api~1v1~1buyer~1identity-bindings/post/requestBody/content/application~1json/schema/$ref").asText()).endsWith("/ExternalIdentityCreateRequest");
    assertThat(spec.at("/components/schemas/ExternalIdentityCreateRequest/properties/userId").isMissingNode()).isFalse();
    assertThat(spec.at("/components/schemas/Create/properties/period").isMissingNode()).isFalse();
  }
  @Test void buyerStrictModePreservesOtherPortalAccountsButRejectsUnmappedBuyers() throws Exception {
    String platform="platform-"+UUID.randomUUID(),platformRole="platform-role-"+UUID.randomUUID();
    jdbc.update("insert into users(id,name,status) values (?,?,'active')",platform,platform);
    jdbc.update("insert into roles(id,scope,name,permissions,data_scope) values (?,'platform','平台','[\"platform:*\"]','all')",platformRole);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",platform,platformRole);
    String supplier="supplier-"+UUID.randomUUID(),supplierUser="supplier-user-"+UUID.randomUUID(),supplierRole="supplier-role-"+UUID.randomUUID();
    jdbc.update("insert into enterprises(id,name,type,verified) values (?,?,'supplier',true)",supplier,supplier);
    jdbc.update("insert into users(id,supplier_id,name,status) values (?,?,?,'active')",supplierUser,supplier,supplierUser);
    jdbc.update("insert into roles(id,scope,name,permissions,data_scope) values (?,'supplier','供应商','[\"supplier:*\"]','all')",supplierRole);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",supplierUser,supplierRole);
    for(String scope:List.of("PLATFORM","SUPPLIER","BUYER")){
      var claims=new JWTClaimsSet.Builder().issuer(ISSUER).subject("legacy-"+scope).audience("24bid-api").issueTime(new Date()).expirationTime(Date.from(Instant.now().plusSeconds(300)))
        .claim("userId",scope.equals("PLATFORM")?platform:scope.equals("SUPPLIER")?supplierUser:user).claim("authScope",scope).claim("tenantId",scope.equals("BUYER")?tenant:null).claim("supplierId",scope.equals("SUPPLIER")?supplier:null).build();
      var token=new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KEY.getKeyID()).build(),claims);token.sign(new RSASSASigner(KEY));
      assertThat(status(token.serialize(),"/api/v1/auth/permissions")).isEqualTo(scope.equals("BUYER")?401:200);
    }
  }
}
