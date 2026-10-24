package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.identity.application.PermissionService;
import com.procurement.mall.api.*;
import com.procurement.mall.application.MallPurchaseControlApplicationService;
import com.procurement.mall.infrastructure.MallPurchaseControlMapper;
import com.procurement.mall.domain.MallPurchaseControl;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class MallPurchaseControlTests {
  @Test void rejectsMissingAndBlankKeysBeforeAnyCheckoutActionOrDatabaseAccess() {
    var mapper = mock(MallPurchaseControlMapper.class);
    var service = new MallPurchaseControlApplicationService(mapper, null,
        mock(PermissionService.class), null, new ObjectMapper(), null);
    var action = new java.util.concurrent.atomic.AtomicInteger();
    for (String operation : List.of("direct", "batch", "cart")) {
      for (String key : java.util.Arrays.asList(null, "", " \t\n")) {
        assertThatThrownBy(() -> service.idempotent(operation, key, new Object(), () -> {
          action.incrementAndGet();
          return List.of();
        })).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("提交编号不能为空");
      }
    }
    assertThat(action.get()).isZero();
    verifyNoInteractions(mapper);
  }

  @Test void allThreeHttpRequestTypesRequireANonblankIdempotencyKey() {
    try (var factory = jakarta.validation.Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      for (String key : java.util.Arrays.asList(null, "", " \t\n")) {
        for (Object request : List.of(
            new CreateMallOrderRequest("sku", BigDecimal.ONE, null, key),
            new CreateMallCartRequest(List.of(new CreateMallCartRequest.CartItem("sku", BigDecimal.ONE)), null, key),
            new CheckoutCartRequest(null, null, null, key))) {
          assertThat(validator.validate(request)).anySatisfy(violation -> {
            assertThat(violation.getPropertyPath().toString()).isEqualTo("idempotencyKey");
            assertThat(violation.getConstraintDescriptor().getAnnotation())
                .isInstanceOf(jakarta.validation.constraints.NotBlank.class);
          });
        }
      }
      assertThat(validator.validate(new CreateMallOrderRequest("sku", BigDecimal.ONE, null, "key"))).isEmpty();
      assertThat(validator.validate(new CreateMallCartRequest(
          List.of(new CreateMallCartRequest.CartItem("sku", BigDecimal.ONE)), null, "key"))).isEmpty();
      assertThat(validator.validate(new CheckoutCartRequest(null, null, null, "key"))).isEmpty();
    }
  }

  @Test void appliesLimitToWholeCheckoutAndRequiresAllowedCategoriesAndAddress() {
    var control = new MallPurchaseControl(new BigDecimal("100"), List.of("office"), true);
    assertThatCode(() -> control.check(new BigDecimal("100"), List.of("office"), true)).doesNotThrowAnyException();
    assertThatThrownBy(() -> control.check(new BigDecimal("100.01"), List.of("office"), true)).hasMessageContaining("限额");
    assertThatThrownBy(() -> control.check(BigDecimal.ONE, List.of("lab"), true)).hasMessageContaining("分类");
    assertThatThrownBy(() -> control.check(BigDecimal.ONE, List.of("office"), false)).hasMessageContaining("收货地址");
    assertThatCode(() -> MallPurchaseControl.unrestricted().check(BigDecimal.TEN, java.util.Arrays.asList((String)null), false)).doesNotThrowAnyException();
  }

  @Test void rejectsInvalidControlConfigurationWithoutSilentlyNormalizingIt() {
    assertThatThrownBy(() -> new MallPurchaseControl(BigDecimal.ZERO, List.of(), false)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> new MallPurchaseControl(BigDecimal.TEN, List.of(""), false)).isInstanceOf(IllegalArgumentException.class);
  }
}
