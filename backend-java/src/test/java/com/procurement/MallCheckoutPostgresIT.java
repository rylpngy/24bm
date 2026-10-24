package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.mall.api.*;
import com.procurement.mall.application.*;
import java.math.BigDecimal;
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
class MallCheckoutPostgresIT {
  @Container static final PostgreSQLContainer<?> DB=new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url",DB::getJdbcUrl);r.add("spring.datasource.username",DB::getUsername);r.add("spring.datasource.password",DB::getPassword);
    r.add("keycloak.enabled",()->false);r.add("app.seed.locations",()->"");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired MallApplicationService mall;
  @Autowired MallCartApplicationService cart;
  @Autowired MallPurchaseControlApplicationService controls;
  String tenant,supplier,user,product,sku,category;
  @BeforeEach void seed() {
    String id="checkout-"+UUID.randomUUID();tenant=id+"t";supplier=id+"s";user=id+"u";product=id+"p";sku=id+"sku";category=id+"c";
    jdbc.update("insert into tenants(id,name,plan,status,enabled_features) values (?,'Mall buyer','starter','active','[\"mall\",\"order\"]'::jsonb)",tenant);
    jdbc.update("insert into enterprises(id,name,type) values (?,'Supplier','supplier')",supplier);
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Buyer','active')",user,tenant);
    jdbc.update("insert into roles(id,tenant_id,name,scope,permissions) values (?,?,'Mall operator','buyer','[\"buyer:*\"]'::jsonb)",id+"role",tenant);
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)",user,id+"role");
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values (?,?,?,'已准入','普通')",id+"rel",tenant,supplier);
    jdbc.update("insert into mall_categories(id,tenant_id,name) values (?,?,'Office')",category,tenant);
    jdbc.update("insert into mall_products(id,scope,tenant_id,supplier_id,name,status,category_id) values (?,'tenant',?,?,'Paper','在架',?)",product,tenant,supplier,category);
    jdbc.update("insert into mall_skus(id,product_id,sku_code,unit,price,status,stock_qty,lead_time_days) values (?,?,'A4','box',12.35,'在架',20,2)",sku,product);
    buyer();
  }
  void buyer(){TenantContext.set(tenant,null,user);}
  @AfterEach void clear(){TenantContext.clear();}
  CreateMallOrderRequest request(String key){return new CreateMallOrderRequest(sku,BigDecimal.TWO,null,key);}
  int orders(){return jdbc.queryForObject("select count(*) from purchase_orders where tenant_id=?",Integer.class,tenant);}
  @Test void concurrentRepeatedSubmissionCreatesOneOrderWithExactSkuAndAmount() throws Exception {
    var start=new CountDownLatch(1);
    try(var pool=Executors.newFixedThreadPool(2)) {
      Callable<MallOrderResponse> task=()->{buyer();try{start.await();return mall.createDirectOrder(request("same"));}finally{TenantContext.clear();}};
      var first=pool.submit(task);var second=pool.submit(task);start.countDown();
      var a=first.get(30,TimeUnit.SECONDS);var b=second.get(30,TimeUnit.SECONDS);
      assertThat(a.orderId()).isEqualTo(b.orderId());assertThat(orders()).isEqualTo(1);
      assertThat(a.amount()).isEqualByComparingTo("24.70");
      assertThat(jdbc.queryForObject("select source_sku_id from order_line_items where order_id=?",String.class,a.orderId())).isEqualTo(sku);
      assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,sku)).isEqualByComparingTo("18");
    }
    buyer();
    assertThatThrownBy(()->mall.createDirectOrder(new CreateMallOrderRequest(sku,BigDecimal.ONE,null,"same"))).hasMessageContaining("已变化");
    assertThat(orders()).isEqualTo(1);
  }
  @Test void policyAndForeignAddressRejectAtomicallyAndCanBeCorrected() {
    controls.save(new SaveMallPurchaseControlRequest(new BigDecimal("20"),List.of(category),false,"Limit"));
    assertThatThrownBy(()->mall.createDirectOrder(request("limit"))).hasMessageContaining("限额");assertThat(orders()).isZero();
    controls.save(new SaveMallPurchaseControlRequest(new BigDecimal("100"),List.of(category),true,"Address"));
    assertThatThrownBy(()->mall.createDirectOrder(request("address"))).hasMessageContaining("收货地址");
    assertThatThrownBy(()->mall.checkoutServerCart(new CheckoutCartRequest("foreign",null,null,"foreign"))).hasMessageContaining("空");
    assertThat(orders()).isZero();
    controls.save(new SaveMallPurchaseControlRequest(new BigDecimal("100"),List.of(category),false,"Allow"));
    assertThat(mall.createDirectOrder(request("limit")).amount()).isEqualByComparingTo("24.70");
  }
  @Test void batchRejectsDuplicateSkusRatherThanChangingTierOrQuantitySemantics() {
    var item=new CreateMallCartRequest.CartItem(sku,BigDecimal.ONE);
    assertThatThrownBy(()->mall.checkoutCart(new CreateMallCartRequest(List.of(item,item),null,"dup"))).hasMessageContaining("重复");
    assertThat(orders()).isZero();
  }
  @Test void doesNotCreateOrdersWhichCurrentShipmentHeaderCannotRepresent() {
    jdbc.update("update mall_skus set min_order_qty=0.5,step_qty=0.5 where id=?",sku);
    assertThatThrownBy(()->mall.createDirectOrder(new CreateMallOrderRequest(sku,new BigDecimal("0.5"),null,"fraction")))
        .hasMessageContaining("履约总数量");
    assertThat(orders()).isZero();
  }
  @Test void serverCartRejectsForeignAddressAndPersistsSupplierVisibleNote() {
    cart.addItem(sku,BigDecimal.TWO);
    assertThatThrownBy(()->mall.checkoutServerCart(new CheckoutCartRequest("foreign",null,null,"address")))
        .hasMessageContaining("地址不存在");
    assertThat(cart.view().itemCount()).isEqualTo(1);
    var placed=mall.checkoutServerCart(new CheckoutCartRequest(null,null,"  请工作日送达  ","note"));
    String order=placed.getFirst().orderId();
    assertThat(controls.buyerCheckoutNote(order)).isEqualTo("请工作日送达");
    assertThat(cart.view().itemCount()).isZero();
    assertThat(mall.checkoutServerCart(new CheckoutCartRequest(null,null,"  请工作日送达  ","note")).getFirst().orderId()).isEqualTo(order);
  }
  @Test void comparisonUsesActualTierPriceAndNeverConflatesUnitsOrParameters() {
    String material=product+"mat";
    jdbc.update("insert into materials(id,tenant_id,code,name,category,unit) values (?,?,'MAT','Paper','Office','box')",material,tenant);
    jdbc.update("update mall_skus set material_id=?,spec='{\"size\":\"A4\"}'::jsonb where id=?",material,sku);
    jdbc.update("insert into mall_sku_tier_prices(sku_id,min_qty,price) values (?,5,10)",sku);
    jdbc.update("insert into mall_skus(id,product_id,sku_code,material_id,unit,price,status,spec) values (?,?,'A3',?,'box',11,'在架','{\"size\":\"A3\"}'::jsonb)",sku+"diff",product,material);
    jdbc.update("insert into mall_skus(id,product_id,sku_code,material_id,unit,price,status) values (?,?,'Other unit',?,'each',1,'在架')",sku+"unit",product,material);
    var rows=controls.compare(sku,new BigDecimal("5"));
    assertThat(rows).hasSize(2);
    assertThat(rows.getFirst().unitPrice()).isEqualByComparingTo("10");
    assertThat(rows.getFirst().total()).isEqualByComparingTo("50");
    assertThat(rows.getFirst().sameSpecification()).isTrue();
    assertThat(rows.getLast().sameSpecification()).isFalse();
  }

  @Test void comparisonFiltersAndPricesAllCandidatesBeforeLimitingToCheapestHundred() {
    String material=product+"mat";
    jdbc.update("insert into materials(id,tenant_id,code,name,category,unit) values (?,?,'MAT','Paper','Office','box')",material,tenant);
    jdbc.update("update mall_skus set material_id=?,stock_qty=0 where id=?",material,sku);
    for(int i=0;i<101;i++) {
      jdbc.update("insert into mall_skus(id,product_id,sku_code,material_id,unit,price,status,stock_qty) values (?,?,?,?,'box',1,'在架',0)",
          sku+String.format("-a%03d",i),product,"unavailable-"+i,material);
    }
    String cheapest=sku+"-z-cheapest";
    jdbc.update("insert into mall_skus(id,product_id,sku_code,material_id,unit,price,status,stock_qty) values (?,?,'Cheapest',?,'box',12,'在架',20)",cheapest,product,material);
    jdbc.update("insert into mall_sku_tier_prices(sku_id,min_qty,price) values (?,5,7.77)",cheapest);
    var rows=controls.compare(sku,new BigDecimal("5"));
    assertThat(rows).extracting(MallComparisonRow::skuId).containsExactly(cheapest);
    assertThat(rows.getFirst().unitPrice()).isEqualByComparingTo("7.77");
    assertThat(rows.getFirst().total()).isEqualByComparingTo("38.85");
    for(int i=0;i<101;i++) {
      jdbc.update("insert into mall_skus(id,product_id,sku_code,material_id,unit,price,status,stock_qty) values (?,?,?,?,'box',10,'在架',20)",
          sku+String.format("-b%03d",i),product,"available-"+i,material);
    }
    rows=controls.compare(sku,new BigDecimal("5"));
    assertThat(rows).hasSize(100);
    assertThat(rows.getFirst().skuId()).isEqualTo(cheapest);
    assertThat(rows).extracting(MallComparisonRow::unitPrice).isSorted();
    assertThat(rows).extracting(MallComparisonRow::skuId).doesNotHaveDuplicates();
  }

  @Test void differentKeysCompetingForLastStockProduceExactlyOneCompleteOrder() throws Exception {
    jdbc.update("update mall_skus set stock_qty=1 where id=?",sku);
    var start=new CountDownLatch(1);
    try(var pool=Executors.newFixedThreadPool(2)) {
      List<Future<Boolean>> results=new ArrayList<>();
      for(String key:List.of("stock-a","stock-b")) {
        results.add(pool.submit(()->{
          buyer();
          try {
            start.await();
            mall.createDirectOrder(new CreateMallOrderRequest(sku,BigDecimal.ONE,null,key));
            return true;
          } catch(IllegalStateException rejected) {
            assertThat(rejected).hasMessageContaining("库存不足");
            return false;
          } finally {TenantContext.clear();}
        }));
      }
      start.countDown();
      assertThat(List.of(results.get(0).get(30,TimeUnit.SECONDS),results.get(1).get(30,TimeUnit.SECONDS)))
          .containsExactlyInAnyOrder(true,false);
    }
    buyer();
    assertThat(orders()).isEqualTo(1);
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,sku)).isEqualByComparingTo("0");
    for(String table:List.of("rfqs","order_line_items","mall_checkout_attempts")) {
      assertThat(jdbc.queryForObject("select count(*) from "+table+" where tenant_id=?",Integer.class,tenant)).isEqualTo(1);
    }
  }

  @Test void laterSupplierFailureRollsBackEarlierOrderStockNotesAndAttemptWithoutClearingCart() {
    String secondSupplier=supplier+"second",secondProduct=product+"second",secondSku=sku+"second";
    jdbc.update("insert into enterprises(id,name,type) values (?,'Exited supplier','supplier')",secondSupplier);
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values (?,?,?,'已退出','普通')",supplier+"second-rel",tenant,secondSupplier);
    jdbc.update("insert into mall_products(id,scope,tenant_id,supplier_id,name,status,category_id) values (?,'tenant',?,?,'Second','在架',?)",secondProduct,tenant,secondSupplier,category);
    jdbc.update("insert into mall_skus(id,product_id,sku_code,unit,price,status,stock_qty,lead_time_days) values (?,?,'Second','box',10,'在架',20,2)",secondSku,secondProduct);
    cart.addItem(sku,BigDecimal.TWO);
    cart.addItem(secondSku,BigDecimal.TWO);
    // Fix supplier order independently of timestamp resolution and UUID ordering.
    jdbc.update("update mall_cart_items set created_at=case when sku_id=? then timestamp '2026-01-01 00:00:00' else timestamp '2026-01-01 00:00:01' end where sku_id in (?,?)",sku,sku,secondSku);
    var request=new CheckoutCartRequest(null,null,"rollback note","late-failure");
    assertThatThrownBy(()->mall.checkoutServerCart(request)).isInstanceOf(IllegalStateException.class).hasMessageContaining("供应商未准入");
    assertThat(orders()).isZero();
    for(String table:List.of("rfqs","order_line_items","mall_order_checkout_notes","mall_checkout_attempts")) {
      assertThat(jdbc.queryForObject("select count(*) from "+table+" where tenant_id=?",Integer.class,tenant)).isZero();
    }
    for(String id:List.of(sku,secondSku)) {
      assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?",BigDecimal.class,id)).isEqualByComparingTo("20");
    }
    assertThat(cart.view().itemCount()).isEqualTo(2);
    jdbc.update("update buyer_supplier_relations set status='已准入' where tenant_id=? and supplier_id=?",tenant,secondSupplier);
    assertThat(mall.checkoutServerCart(request)).hasSize(2);
    assertThat(orders()).isEqualTo(2);
    assertThat(cart.view().itemCount()).isZero();
    assertThat(jdbc.queryForObject("select count(*) from mall_order_checkout_notes where tenant_id=?",Integer.class,tenant)).isEqualTo(2);
  }
}
