package com.procurement.agency.application;

import com.fasterxml.jackson.databind.*;
import com.procurement.agency.domain.AgencySmsRecords.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import javax.crypto.*;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Signed HTTP adapter contract. Vendor credentials belong in the gateway, never browser
 * configuration.
 */
@Component
public class AgencySmsGateway {
  final String url, secret, encryption;
  final ObjectMapper json;
  final HttpClient client =
      HttpClient.newBuilder()
          .connectTimeout(Duration.ofSeconds(3))
          .followRedirects(HttpClient.Redirect.NEVER)
          .build();

  public AgencySmsGateway(
      @Value("${agency.sms.url:}") String url,
      @Value("${agency.sms.secret:}") String secret,
      @Value("${agency.sms.encryption-key:}") String encryption,
      ObjectMapper json) {
    this.url = url;
    this.secret = secret;
    this.encryption = encryption;
    this.json = json;
  }

  public boolean configured() {
    try {
      var u = URI.create(url);
      return secret.getBytes(StandardCharsets.UTF_8).length >= 32
          && Base64.getDecoder().decode(encryption).length == 32
          && u.getUserInfo() == null
          && u.getFragment() == null
          && u.getQuery() == null
          && u.getHost() != null
          && (u.getScheme().equals("https")
              || (u.getScheme().equals("http")
                  && Set.of("127.0.0.1", "localhost").contains(u.getHost())));
    } catch (Exception e) {
      return false;
    }
  }

  public void ready() {
    if (!configured()) throw new IllegalStateException("短信网关及独立加密密钥未配置，未发送");
  }

  public String signature(String timestamp, byte[] body) {
    ready();
    try {
      var mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(mac.doFinal(body));
    } catch (Exception e) {
      throw new IllegalStateException("短信签名失败");
    }
  }

  public void verify(String timestamp, String signature, byte[] body) {
    try {
      if (body.length > 16384
          || Math.abs(Instant.now().getEpochSecond() - Long.parseLong(timestamp)) > 300
          || !MessageDigest.isEqual(
              signature(timestamp, body).getBytes(StandardCharsets.US_ASCII),
              signature.getBytes(StandardCharsets.US_ASCII))) throw new Exception();
    } catch (Exception e) {
      throw new com.procurement.common.tenant.PermissionDeniedException("短信回执签名无效或过期");
    }
  }

  public String encrypt(String tenant, String user, String phone) {
    ready();
    try {
      byte[] iv = new byte[12];
      new SecureRandom().nextBytes(iv);
      var c = Cipher.getInstance("AES/GCM/NoPadding");
      c.init(
          Cipher.ENCRYPT_MODE,
          new SecretKeySpec(Base64.getDecoder().decode(encryption), "AES"),
          new GCMParameterSpec(128, iv));
      c.updateAAD((tenant + ":" + user).getBytes(StandardCharsets.UTF_8));
      return Base64.getEncoder().encodeToString(iv)
          + "."
          + Base64.getEncoder().encodeToString(c.doFinal(phone.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("短信联系人加密失败");
    }
  }

  String phone(Contact contact) {
    ready();
    try {
      var values = contact.phoneCipher().split("\\.");
      var c = Cipher.getInstance("AES/GCM/NoPadding");
      c.init(
          Cipher.DECRYPT_MODE,
          new SecretKeySpec(Base64.getDecoder().decode(encryption), "AES"),
          new GCMParameterSpec(128, Base64.getDecoder().decode(values[0])));
      c.updateAAD((contact.tenantId() + ":" + contact.userId()).getBytes(StandardCharsets.UTF_8));
      return new String(c.doFinal(Base64.getDecoder().decode(values[1])), StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("短信联系人解密失败");
    }
  }

  public record Result(String status, String reference, String note) {}

  public Result send(Delivery d, Contact contact) {
    ready();
    try {
      byte[] body =
          json.writeValueAsBytes(
              Map.of(
                  "tenantId",
                  d.tenantId(),
                  "clientId",
                  d.id(),
                  "recipient",
                  phone(contact),
                  "template",
                  "agency_reminder_v1",
                  "parameters",
                  Map.of("message", "您有采购项目计划提醒，请登录业务系统查看。")));
      String timestamp = String.valueOf(Instant.now().getEpochSecond());
      var request =
          HttpRequest.newBuilder(URI.create(url))
              .timeout(Duration.ofSeconds(8))
              .header("Content-Type", "application/json")
              .header("Idempotency-Key", d.id())
              .header("X-24BM-Timestamp", timestamp)
              .header("X-24BM-Signature", signature(timestamp, body))
              .POST(HttpRequest.BodyPublishers.ofByteArray(body))
              .build();
      var future = client.sendAsync(request, info -> new AgencyOfficeTransport.LimitedBody(16384));
      HttpResponse<byte[]> response;
      try {
        response = future.get(10, java.util.concurrent.TimeUnit.SECONDS);
      } finally {
        if (!future.isDone()) future.cancel(true);
      }
      byte[] bytes = response.body();
      if (bytes.length > 16384) return new Result("unknown", null, "网关响应超过限制，等待查询或回执");
      verify(
          response.headers().firstValue("X-24BM-Timestamp").orElse(""),
          response.headers().firstValue("X-24BM-Signature").orElse(""),
          bytes);
      var result = json.readTree(bytes);
      if (!result.path("clientId").asText().equals(d.id()))
        return new Result("unknown", null, "网关响应身份不符，等待查询或回执");
      String ref = result.path("providerRef").asText();
      if (response.statusCode() == 200
          && result.path("status").asText().equals("accepted")
          && !ref.isBlank()
          && ref.length() <= 200) return new Result("accepted", ref, "网关受理，尚无送达回执");
      if (result.path("status").asText().equals("rejected"))
        return new Result("failed", null, "网关明确拒绝，未受理");
      return new Result("unknown", null, "网关未返回明确受理状态，等待查询或回执");
    } catch (Exception e) {
      if (e instanceof InterruptedException) Thread.currentThread().interrupt();
      return new Result("unknown", null, "请求中断、超时或响应验证失败，结果未知，禁止盲目重发");
    }
  }
}
