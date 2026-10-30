package com.procurement.contract.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.springframework.stereotype.Component;

@Component
public class ContractReviewCodec {
  private final ObjectMapper json;
  public ContractReviewCodec(ObjectMapper json){this.json=json;}
  public String write(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException("审查记录序列化失败",e);}}
  public <T>T read(String value,TypeReference<T> type){try{return json.readValue(value,type);}catch(Exception e){throw new IllegalStateException("审查记录无法读取",e);}}
  public static String hash(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}}
  public String hashText(Object value){return hash(write(value).getBytes(StandardCharsets.UTF_8));}
}
