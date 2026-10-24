package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.identity.domain.BuyerRoleAssignments;
import com.procurement.identity.domain.BuyerRolePolicy;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class BuyerRolePolicyTests {
  @Test void recognizesOnlyTheCurrentTenantsProvisionedOwnerAndTheLegacyOwner() {
    assertThat(BuyerRolePolicy.isProtectedOwner("role-buyer-owner", "t")).isTrue();
    assertThat(BuyerRolePolicy.isProtectedOwner("role-t-buyer-owner", "t")).isTrue();
    assertThat(BuyerRolePolicy.isBuiltIn("role-t-buyer-owner", "t")).isTrue();
    assertThat(BuyerRolePolicy.isProtectedOwner("role-other-buyer-owner", "t")).isFalse();
    assertThat(BuyerRolePolicy.isProtectedOwner("role-t-buyer-owner-copy", "t")).isFalse();
    assertThat(BuyerRolePolicy.isBuiltIn("role-custom-id", "t")).isFalse();
  }

  @Test void explicitRoleIdsTakePrecedenceAndAreDeduplicated() {
    assertThat(BuyerRoleAssignments.resolve(List.of("a", "b", "a"), "legacy"))
        .containsExactly("a", "b");
    assertThat(BuyerRoleAssignments.resolve(null, "legacy")).containsExactly("legacy");
  }

  @Test void missingEmptyBlankOrNullAssignmentsNeverBecomeAnEmptyAuthorizationWrite() {
    assertThatThrownBy(() -> BuyerRoleAssignments.resolve(null, null)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> BuyerRoleAssignments.resolve(List.of(), "legacy")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> BuyerRoleAssignments.resolve(List.of(" "), null)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> BuyerRoleAssignments.resolve(Arrays.asList("a", null), null)).isInstanceOf(IllegalArgumentException.class);
  }
}
