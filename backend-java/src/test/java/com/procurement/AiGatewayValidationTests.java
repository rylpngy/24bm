package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.ai.infrastructure.OpenAiCompatibleGateway;
import com.procurement.common.ai.*;
import com.procurement.common.ai.AiContracts.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.*;
import org.junit.jupiter.api.*;

class AiGatewayValidationTests {
  ObjectMapper json=new ObjectMapper();
  HttpServer server;
  AtomicInteger calls=new AtomicInteger();
  AtomicReference<String> content=new AtomicReference<>();
  AtomicReference<String> requestBody=new AtomicReference<>();
  Snapshot snapshot=new Snapshot("r",List.of(AiSupport.field("budget","预算","-1","d","h")),
      List.of(AiSupport.finding("risk","risk","预算异常","预算为负值","budget")),List.of(),List.of());
  String url;
  @BeforeEach void start() throws Exception {
    server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
    server.createContext("/model",exchange -> {
      calls.incrementAndGet(); requestBody.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));
      byte[] body=json.writeValueAsBytes(Map.of("choices",List.of(Map.of("message",Map.of("content",content.get())))));
      exchange.sendResponseHeaders(200,body.length); exchange.getResponseBody().write(body); exchange.close();
    }); server.start(); url="http://127.0.0.1:"+server.getAddress().getPort()+"/model";
  }
  @AfterEach void stop() { server.stop(0); }
  @Test void validEvidenceSelectionUsesModelWithoutChangingRuleFacts() {
    content.set("{\"focusEvidenceIds\":[\"budget\"],\"action\":\"review_evidence\"}");
    var result=new OpenAiCompatibleGateway(json,true,url,"test-key","test-model").analyze(snapshot);
    assertThat(result.mode()).isEqualTo("AI_MODEL"); assertThat(result.summary()).contains("预算");
    assertThat(snapshot.findings().getFirst().severity()).isEqualTo("risk"); assertThat(calls.get()).isEqualTo(1);
  }
  @Test void fabricatedCitationsAndNarrativeSeverityChangesAreRejected() {
    var gateway=new OpenAiCompatibleGateway(json,true,url,"test-key","test-model");
    for(String response:List.of(
        "{\"focusEvidenceIds\":[\"invented-policy\"],\"action\":\"review_evidence\"}",
        "{\"focusEvidenceIds\":[\"budget\"],\"action\":\"review_evidence\",\"summary\":\"approved\"}",
        "{\"findings\":[],\"severity\":\"info\"}","{}","not json")) {
      content.set(response); assertThat(gateway.analyze(snapshot).mode()).isEqualTo("RULE_FALLBACK");
    }
  }
  @Test void missingKeyAndDisabledGatewayPerformZeroHttpRequests() {
    content.set("{}");
    assertThat(new OpenAiCompatibleGateway(json,true,url,"","m").analyze(snapshot).mode()).isEqualTo("RULE_ASSISTED");
    assertThat(new OpenAiCompatibleGateway(json,false,url,"key","m").analyze(snapshot).mode()).isEqualTo("RULE_ASSISTED");
    assertThat(calls.get()).isZero();
  }
  @Test void oversizedResponsesAreBoundedAndFallBack() {
    content.set("x".repeat(40000));
    assertThat(new OpenAiCompatibleGateway(json,true,url,"key","m").analyze(snapshot).mode()).isEqualTo("RULE_FALLBACK");
  }
  @Test void providerThinkingOptionIsOmittedUnlessConfigured() throws Exception {
    content.set("{\"focusEvidenceIds\":[\"budget\"],\"action\":\"review_evidence\"}");
    var gateway=new OpenAiCompatibleGateway(json,true,url,"test-key","qwen3.8-flash");
    assertThat(gateway.configured()).isTrue();gateway.analyze(snapshot);
    assertThat(json.readTree(requestBody.get()).has("enable_thinking")).isFalse();
    assertThat(json.readTree(requestBody.get()).path("messages").path(0).path("content").asText()).contains("JSON");
    gateway.configureThinking(false);assertThat(gateway.analyze(snapshot).mode()).isEqualTo("AI_MODEL");
    assertThat(json.readTree(requestBody.get()).path("enable_thinking").booleanValue()).isFalse();
  }
}
