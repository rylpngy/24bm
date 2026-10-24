package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.procurement.common.production.ProductionConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.io.ClassPathResource;

class ProductionConfigurationTests {
  private MockEnvironment safe() {
    return new MockEnvironment()
        .withProperty("app.seed.locations", "")
        .withProperty("procurement.security.allow-demo-jwt-secret", "false")
        .withProperty("procurement.security.self-issued-login-enabled", "false")
        .withProperty("procurement.security.self-issued-token-accepted", "false")
        .withProperty("procurement.security.tenant-header-fallback-enabled", "false")
        .withProperty("spring.flyway.clean-disabled", "true")
        .withProperty("spring.flyway.baseline-on-migrate", "false")
        .withProperty("spring.flyway.out-of-order", "false")
        .withProperty("spring.flyway.validate-on-migrate", "true")
        .withProperty("keycloak.enabled", "true")
        .withProperty("keycloak.issuer-uri", "https://identity.example.edu/realms/company")
        .withProperty("keycloak.audience", "24bid-api")
        .withProperty("keycloak.jwk-set-uri", "https://identity.example.edu/realms/company/protocol/openid-connect/certs")
        .withProperty("procurement.security.cors-allowed-origins", "https://buyer.example.edu,https://supplier.example.edu");
  }

  @Test void acceptsExplicitSafeConfiguration() {
    assertThatCode(() -> ProductionConfiguration.validate(safe())).doesNotThrowAnyException();
  }

  @Test void rejectsUnsafeOverrides() {
    for (String key : new String[] {"procurement.security.allow-demo-jwt-secret",
        "procurement.security.self-issued-token-accepted",
        "procurement.security.self-issued-login-enabled", "procurement.security.tenant-header-fallback-enabled",
        "spring.flyway.baseline-on-migrate", "spring.flyway.out-of-order"}) {
      assertThatThrownBy(() -> ProductionConfiguration.validate(safe().withProperty(key, "true")))
          .isInstanceOf(IllegalStateException.class).hasMessageContaining(key);
    }
    for (String key : new String[] {"spring.flyway.clean-disabled", "spring.flyway.validate-on-migrate", "keycloak.enabled"}) {
      assertThatThrownBy(() -> ProductionConfiguration.validate(safe().withProperty(key, "false")))
          .isInstanceOf(IllegalStateException.class).hasMessageContaining(key);
    }
  }

  @Test void rejectsSeedsAndUnsafeIdentityEndpointsWithoutLeakingValues() {
    assertThatThrownBy(() -> ProductionConfiguration.validate(safe().withProperty("keycloak.audience", "")))
        .hasMessageContaining("keycloak.audience");
    assertThatThrownBy(() -> ProductionConfiguration.validate(safe().withProperty("keycloak.issuer-uri", "")))
        .hasMessageContaining("keycloak.issuer-uri");
    assertThatThrownBy(() -> ProductionConfiguration.validate(safe().withProperty("app.seed.locations", "classpath:db/demo")))
        .hasMessageContaining("app.seed.locations");
    for (String value : new String[] {"http://identity.example.edu/certs", "https://user:secret@id.example.edu/certs", "https://localhost/certs", "https://127.0.0.1/certs", "invalid"}) {
      assertThatThrownBy(() -> ProductionConfiguration.validate(safe().withProperty("keycloak.jwk-set-uri", value)))
          .isInstanceOf(IllegalStateException.class).hasMessageNotContaining("secret@");
    }
  }

  @Test void rejectsWildcardPathsAndInsecureCors() {
    for (String value : new String[] {"*", "https://*.example.edu", "http://buyer.example.edu", "https://buyer.example.edu/path", "https://buyer.example.edu?token=secret", ""}) {
      assertThatThrownBy(() -> ProductionConfiguration.validate(safe().withProperty("procurement.security.cors-allowed-origins", value)))
          .isInstanceOf(IllegalStateException.class).hasMessageContaining("cors-allowed-origins");
    }
  }

  @Test void runsOnlyForExplicitProductionProfile() {
    new ApplicationContextRunner().withUserConfiguration(ProductionConfiguration.class)
        .run(context -> org.assertj.core.api.Assertions.assertThat(context).hasNotFailed());
    new ApplicationContextRunner().withUserConfiguration(ProductionConfiguration.class)
        .withPropertyValues("spring.profiles.active=prod")
        .run(context -> org.assertj.core.api.Assertions.assertThat(context).hasFailed());
  }

  @Test void packagedProductionProfileDisablesPublicDiagnostics() throws Exception {
    var properties = new YamlPropertySourceLoader()
        .load("production", new ClassPathResource("application-prod.yml")).getFirst();
    var env = safe();
    env.getPropertySources().addFirst(properties);
    assertThatCode(() -> ProductionConfiguration.validate(env)).doesNotThrowAnyException();
    org.assertj.core.api.Assertions.assertThat(env.getProperty("management.endpoint.health.show-details")).isEqualTo("never");
    org.assertj.core.api.Assertions.assertThat(env.getProperty("springdoc.api-docs.enabled")).isEqualTo("false");
    org.assertj.core.api.Assertions.assertThat(env.getProperty("springdoc.swagger-ui.enabled")).isEqualTo("false");
  }
}
