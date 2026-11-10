package com.procurement.agency.application;

import com.fasterxml.jackson.databind.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

@Component
public class AgencyJson {
  private final ObjectMapper json;

  public AgencyJson(ObjectMapper json) {
    this.json = json.copy().enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
  }

  public String write(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalArgumentException("档案数据无法序列化", e);
    }
  }

  public <T> T read(String value, Class<T> type) {
    try {
      return json.readValue(value, type);
    } catch (Exception e) {
      throw new IllegalStateException("档案快照无法读取", e);
    }
  }

  public String hash(Object value) {
    return bytesHash(write(value).getBytes(StandardCharsets.UTF_8));
  }

  public String bytesHash(byte[] bytes) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  public JsonNode tree(String value) {
    try {
      return json.readTree(value);
    } catch (Exception e) {
      throw new IllegalStateException("配置快照无法读取", e);
    }
  }
}
