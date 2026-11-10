package com.procurement.agency.application;

import com.fasterxml.jackson.databind.*;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AgencyOfficeTransport {
  final ObjectMapper json;
  final boolean enabled;
  final String publicUrl, internalUrl, bridgeUrl, secret;
  final HttpClient http =
      HttpClient.newBuilder()
          .connectTimeout(Duration.ofSeconds(3))
          .followRedirects(HttpClient.Redirect.NEVER)
          .build();

  public AgencyOfficeTransport(
      ObjectMapper json,
      @Value("${agency.office.enabled:false}") boolean enabled,
      @Value("${agency.office.public-url:}") String publicUrl,
      @Value("${agency.office.internal-url:}") String internalUrl,
      @Value("${agency.office.bridge-url:}") String bridgeUrl,
      @Value("${agency.office.jwt-secret:}") String secret) {
    this.json = json;
    this.enabled = enabled;
    this.publicUrl = trim(publicUrl);
    this.internalUrl = trim(internalUrl);
    this.bridgeUrl = trim(bridgeUrl);
    this.secret = secret;
  }

  static String trim(String s) {
    return s == null ? "" : s.replaceAll("/+$", "");
  }

  boolean endpoint(String url) {
    try {
      var u = URI.create(url);
      return u.getHost() != null
          && u.getUserInfo() == null
          && u.getFragment() == null
          && u.getQuery() == null
          && (u.getPath().isEmpty() || u.getPath().equals("/"))
          && (u.getScheme().equals("https")
              || u.getScheme().equals("http")
                  && Set.of("localhost", "127.0.0.1", "host.docker.internal", "[::1]")
                      .contains(u.getHost()));
    } catch (Exception e) {
      return false;
    }
  }

  public boolean configured() {
    return enabled
        && secret != null
        && secret.getBytes(StandardCharsets.UTF_8).length >= 32
        && endpoint(publicUrl)
        && endpoint(internalUrl)
        && endpoint(bridgeUrl);
  }

  void ready() {
    if (!configured()) throw new IllegalStateException("Office在线服务未配置完整，保留整份Word下载／上传路径");
  }

  public String sign(Map<String, ?> payload, OffsetDateTime expires) {
    ready();
    return Jwts.builder()
        .claims(payload)
        .expiration(Date.from(expires.toInstant()))
        .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256)
        .compact();
  }

  public JsonNode verify(String token) {
    ready();
    try {
      var parsed =
          Jwts.parser()
              .verifyWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)))
              .build()
              .parseSignedClaims(token);
      if (!parsed.getHeader().getAlgorithm().equals("HS256")) throw new IllegalArgumentException();
      var n = json.valueToTree(parsed.getPayload());
      return n.has("payload") ? n.path("payload") : n;
    } catch (Exception e) {
      throw new com.procurement.common.tenant.PermissionDeniedException("Office回调签名无效或已过期");
    }
  }

  public String ticket(String tenant, String session, String key) {
    ready();
    try {
      var mac = javax.crypto.Mac.getInstance("HmacSHA256");
      mac.init(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)));
      return HexFormat.of()
          .formatHex(
              mac.doFinal(
                  ("office-source:" + tenant + ":" + session + ":" + key)
                      .getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException("Office访问票据生成失败");
    }
  }

  static int port(URI u) {
    return u.getPort() < 0 ? (u.getScheme().equals("https") ? 443 : 80) : u.getPort();
  }

  boolean sameOrigin(URI a, URI b) {
    return Objects.equals(a.getHost(), b.getHost())
        && Objects.equals(a.getScheme(), b.getScheme())
        && port(a) == port(b);
  }

  public URI saveUri(String value) {
    ready();
    try {
      var u = URI.create(value);
      String p = u.getRawPath().toLowerCase(Locale.ROOT);
      if (u.getUserInfo() != null
          || u.getFragment() != null
          || !(sameOrigin(u, URI.create(publicUrl)) || sameOrigin(u, URI.create(internalUrl)))
          || !p.startsWith("/cache/files/")
          || p.contains("..")
          || p.contains("%2e")
          || p.contains("%2f")
          || p.contains("%5c")
          || p.contains("\\")) throw new IllegalArgumentException();
      return URI.create(
          internalUrl + u.getRawPath() + (u.getRawQuery() == null ? "" : "?" + u.getRawQuery()));
    } catch (Exception e) {
      throw new IllegalArgumentException("Office保存地址不在已配置的文档服务缓存范围");
    }
  }

  byte[] send(HttpRequest request, int cap) {
    CompletableFuture<HttpResponse<byte[]>> f = null;
    try {
      f = http.sendAsync(request, info -> new LimitedBody(cap));
      var r = f.get(20, TimeUnit.SECONDS);
      if (r.statusCode() != 200) throw new IllegalStateException();
      return r.body();
    } catch (Exception e) {
      if (e instanceof InterruptedException) Thread.currentThread().interrupt();
      throw new IllegalStateException("Office服务请求失败或超过处理限制，请保留草稿后重试");
    } finally {
      if (f != null && !f.isDone()) f.cancel(true);
    }
  }

  public byte[] download(String url) {
    return send(
        HttpRequest.newBuilder(saveUri(url)).timeout(Duration.ofSeconds(20)).GET().build(),
        AgencyFileSafety.MAX_BYTES);
  }

  public Map<String, Object> force(String key) {
    ready();
    try {
      var body = new LinkedHashMap<String, Object>();
      body.put("c", "forcesave");
      body.put("key", key);
      body.put(
          "token", sign(Map.of("c", "forcesave", "key", key), OffsetDateTime.now().plusMinutes(5)));
      var bytes =
          send(
              HttpRequest.newBuilder(URI.create(internalUrl + "/coauthoring/CommandService.ashx"))
                  .timeout(Duration.ofSeconds(15))
                  .header("Content-Type", "application/json")
                  .POST(HttpRequest.BodyPublishers.ofByteArray(json.writeValueAsBytes(body)))
                  .build(),
              65536);
      var n = json.readTree(bytes);
      if (!n.path("error").canConvertToInt()) throw new IllegalStateException();
      return Map.of(
          "accepted",
          n.path("error").asInt() == 0,
          "providerCode",
          n.path("error").asInt(),
          "saved",
          false);
    } catch (IOException e) {
      throw new IllegalStateException("Office保存请求响应无效");
    }
  }

  static final class LimitedBody implements HttpResponse.BodySubscriber<byte[]> {
    final CompletableFuture<byte[]> result = new CompletableFuture<>();
    final ByteArrayOutputStream out = new ByteArrayOutputStream();
    final int cap;
    Flow.Subscription s;

    LimitedBody(int cap) {
      this.cap = cap;
    }

    public CompletionStage<byte[]> getBody() {
      return result;
    }

    public void onSubscribe(Flow.Subscription s) {
      this.s = s;
      s.request(1);
    }

    public void onNext(List<ByteBuffer> chunks) {
      for (var b : chunks) {
        if (b.remaining() > cap - out.size()) {
          s.cancel();
          result.completeExceptionally(new IllegalStateException("Office响应超限"));
          return;
        }
        byte[] a = new byte[b.remaining()];
        b.get(a);
        out.writeBytes(a);
      }
      s.request(1);
    }

    public void onError(Throwable t) {
      result.completeExceptionally(t);
    }

    public void onComplete() {
      result.complete(out.toByteArray());
    }
  }
}
