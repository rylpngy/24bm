package com.procurement.sourcing.domain;

import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

// 中标通知书数字签名:对规范化内容做 HMAC-SHA256,验签可检测篡改(防伪电子签章)。
// 生产应通过 JVM property 或环境变量注入密钥;演示密钥仅用于本地/CI 的确定性样例。
public final class AwardNoticeSignature {

  public static final String ALGORITHM = "HmacSHA256";
  public static final String SECRET_PROPERTY = "procurement.award-notice.signature-secret";
  public static final String SECRET_ENV = "AWARD_NOTICE_SIGNATURE_SECRET";
  public static final String ALLOW_DEMO_SECRET_PROPERTY =
      "procurement.award-notice.allow-demo-secret";
  private static final String DEMO_SECRET = "24bid-award-notice-seal-secret-v1";

  private AwardNoticeSignature() {}

  // 规范化内容:字段以 | 连接,任一字段变化都会导致验签失败。
  public static String canonical(
      String rfqId, String title, String method,
      String winnerSupplierId, String amount, String sealNo, String issuedBy, String issuedAtIso) {
    return String.join("|",
        nz(rfqId), nz(title), nz(method), nz(winnerSupplierId),
        nz(amount), nz(sealNo), nz(issuedBy), nz(issuedAtIso));
  }

  public static String sign(String canonical) {
    try {
      Mac mac = Mac.getInstance(ALGORITHM);
      mac.init(new SecretKeySpec(secretBytes(), ALGORITHM));
      byte[] raw = mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder(raw.length * 2);
      for (byte b : raw) {
        hex.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
      }
      return hex.toString();
    } catch (IllegalStateException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalStateException("Failed to sign award notice", e);
    }
  }

  public static boolean verify(String canonical, String signature) {
    if (signature == null) {
      return false;
    }
    String expected = sign(canonical);
    // 定长比较,避免时序侧信道。
    if (expected.length() != signature.length()) {
      return false;
    }
    int diff = 0;
    for (int i = 0; i < expected.length(); i++) {
      diff |= expected.charAt(i) ^ signature.charAt(i);
    }
    return diff == 0;
  }

  private static String nz(String s) {
    return s == null ? "" : s;
  }

  private static byte[] secretBytes() {
    String configured = firstNonBlank(System.getProperty(SECRET_PROPERTY), System.getenv(SECRET_ENV));
    if (configured != null) {
      return configured.getBytes(StandardCharsets.UTF_8);
    }
    boolean allowDemo = Boolean.parseBoolean(System.getProperty(ALLOW_DEMO_SECRET_PROPERTY, "true"));
    if (allowDemo) {
      return DEMO_SECRET.getBytes(StandardCharsets.UTF_8);
    }
    throw new IllegalStateException(
        "Award notice signature secret must be configured via " + SECRET_PROPERTY + " or " + SECRET_ENV);
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value;
      }
    }
    return null;
  }
}
