package com.procurement.mall.infrastructure;

import com.procurement.mall.domain.MallAddress;
import com.procurement.mall.domain.MallCartItem;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 购物车与收货地址(M-2)。
 *
 * <p>购物车行的读写一律回连 mall_carts 校验租户与下单人,越权 cartId 拿不到也改不动。
 */
@Mapper
public interface MallCartMapper {

  @Select("select id from mall_carts where tenant_id = #{tenantId} and user_id = #{userId}")
  String findCartId(@Param("tenantId") String tenantId, @Param("userId") String userId);

  @Select("select id from mall_carts where tenant_id=#{tenantId} and user_id=#{userId} for update")
  String lockCart(@Param("tenantId") String tenantId,@Param("userId") String userId);

  @Insert("""
      insert into mall_carts (id, tenant_id, user_id) values (#{id}, #{tenantId}, #{userId})
      on conflict (tenant_id, user_id) do nothing
      """)
  void insertCart(
      @Param("id") String id, @Param("tenantId") String tenantId, @Param("userId") String userId);

  @Select("""
      select i.id, i.cart_id, i.sku_id, i.quantity
      from mall_cart_items i
      join mall_carts c on c.id = i.cart_id
      where c.tenant_id = #{tenantId} and c.user_id = #{userId}
      order by i.created_at
      """)
  List<MallCartItem> listItems(@Param("tenantId") String tenantId, @Param("userId") String userId);

  @Insert("""
      insert into mall_cart_items (id, cart_id, sku_id, quantity)
      select #{id}, c.id, #{skuId}, #{quantity}
      from mall_carts c where c.tenant_id = #{tenantId} and c.user_id = #{userId}
      on conflict (cart_id, sku_id)
        do update set quantity = mall_cart_items.quantity + excluded.quantity, updated_at = now()
      """)
  int addItem(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("userId") String userId,
      @Param("skuId") String skuId,
      @Param("quantity") BigDecimal quantity);

  @Update("""
      update mall_cart_items i set quantity = #{quantity}, updated_at = now()
      from mall_carts c
      where c.id = i.cart_id and i.sku_id = #{skuId}
        and c.tenant_id = #{tenantId} and c.user_id = #{userId}
      """)
  int updateQuantity(
      @Param("tenantId") String tenantId,
      @Param("userId") String userId,
      @Param("skuId") String skuId,
      @Param("quantity") BigDecimal quantity);

  @Delete("""
      delete from mall_cart_items i
      using mall_carts c
      where c.id = i.cart_id and i.sku_id = #{skuId}
        and c.tenant_id = #{tenantId} and c.user_id = #{userId}
      """)
  int removeItem(
      @Param("tenantId") String tenantId,
      @Param("userId") String userId,
      @Param("skuId") String skuId);

  @Delete("""
      delete from mall_cart_items i
      using mall_carts c
      where c.id = i.cart_id and c.tenant_id = #{tenantId} and c.user_id = #{userId}
      """)
  int clearCart(@Param("tenantId") String tenantId, @Param("userId") String userId);

  // ── 收货地址 ───────────────────────────────────────────────
  @Select("""
      select id, tenant_id, receiver, phone, province, city, district, detail, is_default
      from mall_addresses where tenant_id = #{tenantId}
      order by is_default desc, created_at desc
      """)
  List<MallAddress> listAddresses(@Param("tenantId") String tenantId);

  @Select("""
      select id, tenant_id, receiver, phone, province, city, district, detail, is_default
      from mall_addresses where tenant_id = #{tenantId} and id = #{id}
      """)
  MallAddress findAddress(@Param("tenantId") String tenantId, @Param("id") String id);

  @Insert("""
      insert into mall_addresses (
        id, tenant_id, receiver, phone, province, city, district, detail, is_default)
      values (
        #{id}, #{tenantId}, #{receiver}, #{phone}, #{province}, #{city}, #{district},
        #{detail}, #{isDefault})
      """)
  void insertAddress(
      @Param("id") String id,
      @Param("tenantId") String tenantId,
      @Param("receiver") String receiver,
      @Param("phone") String phone,
      @Param("province") String province,
      @Param("city") String city,
      @Param("district") String district,
      @Param("detail") String detail,
      @Param("isDefault") boolean isDefault);

  /** 设默认地址前先清空同租户的默认标记,保证「默认」唯一。 */
  @Update("update mall_addresses set is_default = false where tenant_id = #{tenantId}")
  int clearDefault(@Param("tenantId") String tenantId);

  @Update("""
      update mall_addresses set is_default = true, updated_at = now()
      where tenant_id = #{tenantId} and id = #{id}
      """)
  int markDefault(@Param("tenantId") String tenantId, @Param("id") String id);

  @Delete("delete from mall_addresses where tenant_id = #{tenantId} and id = #{id}")
  int deleteAddress(@Param("tenantId") String tenantId, @Param("id") String id);
}
