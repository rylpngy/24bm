package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.identity.api.CreateBuyerUserRequest;
import com.procurement.identity.api.UpdateBuyerUserRequest;
import jakarta.validation.Validation;
import java.util.List;
import org.junit.jupiter.api.Test;

class BuyerMemberRequestValidationTests {
  @Test void httpValidationRejectsMissingLegacyAndMultiRoleSelections() {
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      assertThat(validator.validate(new CreateBuyerUserRequest(
          "Member", null, null, "active", "dept", null, "secret123"))).isNotEmpty();
      assertThat(validator.validate(new UpdateBuyerUserRequest(
          "Member", null, null, "dept", null, null, null))).isNotEmpty();
    }
  }

  @Test void httpValidationAcceptsRoleIdsOnlyAndLegacyOnlyButRejectsExplicitEmptySelection() {
    try (var factory = Validation.buildDefaultValidatorFactory()) {
      var validator = factory.getValidator();
      assertThat(validator.validate(new UpdateBuyerUserRequest(
          "Member", null, null, "dept", null, null, null, List.of("role")))).isEmpty();
      assertThat(validator.validate(new UpdateBuyerUserRequest(
          "Member", null, null, "dept", "legacy", null, null))).isEmpty();
      assertThat(validator.validate(new UpdateBuyerUserRequest(
          "Member", null, null, "dept", "legacy", null, null, List.of()))).isNotEmpty();
    }
  }

  @Test void validationHelperDoesNotLeakIntoTheRequestJsonShape() {
    var tree = new ObjectMapper().valueToTree(new UpdateBuyerUserRequest(
        "Member", null, null, "dept", "legacy", null, null));
    assertThat(tree.has("roleSelectionValid")).isFalse();
  }
}
