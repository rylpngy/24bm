package com.procurement.common.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.procurement.common.ai.AiContracts.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

public final class AiSupport {
  private static final ObjectMapper JSON = new ObjectMapper().findAndRegisterModules();
  private AiSupport() {}
  public static String hash(byte[] bytes) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
    catch (Exception e) { throw new IllegalStateException("SHA-256 unavailable", e); }
  }
  public static String revision(Object value) {
    try { return hash(JSON.writeValueAsBytes(canonical(JSON.valueToTree(value)))); }
    catch (Exception e) { throw new IllegalStateException("Cannot fingerprint AI source", e); }
  }
  private static JsonNode canonical(JsonNode node) {
    if (node.isObject()) {
      ObjectNode result = JSON.createObjectNode();
      TreeSet<String> keys = new TreeSet<>(); node.fieldNames().forEachRemaining(keys::add);
      keys.forEach(key -> result.set(key, canonical(node.get(key)))); return result;
    }
    if (node.isArray()) {
      ArrayNode result = JSON.createArrayNode(); node.forEach(item -> result.add(canonical(item))); return result;
    }
    return node;
  }
  public static String text(Object value) { return value == null ? "" : String.valueOf(value); }
  public static Evidence field(String id, String label, Object value, String sourceId, String hash) {
    return new Evidence(id, "FIELD", id, label, text(value), sourceId, hash, null);
  }
  public static Finding finding(String id, String severity, String title, String detail, String... evidenceIds) {
    return new Finding(id, severity, title, detail, List.of(evidenceIds));
  }
  public static Snapshot snapshot(Object source, List<Evidence> evidence, List<Finding> findings, List<String> limitations) {
    return new Snapshot(revision(source), evidence, findings, limitations, List.of());
  }
  public static void bounded(String value, int max, String label) {
    if (value == null || value.isBlank() || value.length() > max)
      throw new IllegalArgumentException(label + " is required and must not exceed " + max + " characters");
  }
  public static byte[] utf8(String value) { return value.getBytes(StandardCharsets.UTF_8); }
}
