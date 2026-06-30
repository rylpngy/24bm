package com.procurement.sourcing.domain;

import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

// 中标通知书数字签名:对规范化内容做 HMAC-SHA256,验签可检测篡改(防伪电子签章)。
// 演示密钥内置;生产应由 KMS/配置注入,签名仅服务端持密验签。
public final class AwardNoticeSignature {

  public static final String ALGORITHM = "HmacSHA256";
  private static final byte[] SECRET =
      "24bid-award-notice-seal-secret-v1".getBytes(StandardCharsets.UTF_8);

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
      mac.init(new SecretKeySpec(SECRET, ALGORITHM));
      byte[] raw = mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder(raw.length * 2);
      for (byte b : raw) {
        hex.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
      }
      return hex.toString();
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
}
