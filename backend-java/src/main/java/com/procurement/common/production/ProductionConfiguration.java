package com.procurement.common.production;

import java.net.URI;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

/** Validate effective production properties, including deployment-side overrides. */
@Configuration
@Profile("prod")
public class ProductionConfiguration implements InitializingBean {
  private final Environment environment;

  public ProductionConfiguration(Environment environment) {
    this.environment = environment;
  }

  @Override public void afterPropertiesSet() {
    validate(environment);
  }

  public static void validate(Environment env) {
    for (String key : new String[] {"procurement.security.allow-demo-jwt-secret",
        "procurement.security.self-issued-token-accepted",
        "procurement.security.self-issued-login-enabled", "procurement.security.tenant-header-fallback-enabled",
        "spring.flyway.baseline-on-migrate", "spring.flyway.out-of-order"}) {
      require("false".equalsIgnoreCase(env.getProperty(key)), key);
    }
    for (String key : new String[] {"spring.flyway.clean-disabled", "spring.flyway.validate-on-migrate", "keycloak.enabled"}) {
      require("true".equalsIgnoreCase(env.getProperty(key)), key);
    }
    require(env.getProperty("app.seed.locations", "").isBlank(), "app.seed.locations");
    secureUri(env.getProperty("keycloak.jwk-set-uri", ""), "keycloak.jwk-set-uri", false);
    secureUri(env.getProperty("keycloak.issuer-uri", ""), "keycloak.issuer-uri", false);
    require(!env.getProperty("keycloak.audience", "").isBlank(), "keycloak.audience");
    String origins = env.getProperty("procurement.security.cors-allowed-origins", "");
    require(!origins.isBlank(), "procurement.security.cors-allowed-origins");
    for (String origin : origins.split(",", -1)) {
      secureUri(origin.trim(), "procurement.security.cors-allowed-origins", true);
    }
  }

  private static void secureUri(String value, String key, boolean originOnly) {
    try {
      URI uri = URI.create(value);
      String host = uri.getHost();
      require("https".equalsIgnoreCase(uri.getScheme()) && host != null && !host.contains("*")
          && !host.equalsIgnoreCase("localhost") && !host.endsWith(".localhost")
          && !host.startsWith("127.") && !host.equals("[::1]") && !host.equals("0.0.0.0")
          && uri.getRawUserInfo() == null && uri.getRawQuery() == null && uri.getRawFragment() == null
          && (!originOnly || uri.getRawPath() == null || uri.getRawPath().isEmpty()), key);
    } catch (IllegalArgumentException exception) {
      throw new IllegalStateException("Unsafe production configuration: " + key);
    }
  }

  private static void require(boolean valid, String key) {
    if (!valid) throw new IllegalStateException("Unsafe production configuration: " + key);
  }
}
