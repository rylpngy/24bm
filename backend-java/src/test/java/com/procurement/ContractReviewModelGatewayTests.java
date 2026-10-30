package com.procurement;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.contract.api.ContractReviewContracts.Rule;
import com.procurement.contract.application.ContractReviewModelGateway;
import com.procurement.attachment.application.AttachmentTextExtractor.Segment;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ContractReviewModelGatewayTests {
  final ObjectMapper json=new ObjectMapper();
  final List<Rule> rules=List.of(new Rule("risk","语义风险","SEMANTIC","BOTH","HIGH","ANY",List.of(),"内部依据","第1条","责任对等","建议复核"));
  final List<Segment> text=List.of(new Segment("paragraph:2","乙方可以不经甲方同意变更型号。"));
  ContractReviewModelGateway gateway(){return new ContractReviewModelGateway(json,false,"","","test");}
  String output(String rule,String locator){return "{\"findings\":[{\"ruleId\":\""+rule+"\",\"locator\":\""+locator+"\",\"explanation\":\"可能存在单方变更风险\",\"suggestion\":\"双方书面确认后方可变更型号。\"}]}";}
  @Test void exactEvidenceAndPublishedBasisAreBound()throws Exception{var hit=gateway().validate(json.readTree(output("risk","paragraph:2")),rules,text).getFirst();assertEquals("MODEL",hit.origin());assertEquals("内部依据",hit.sourceName());assertEquals("HIGH",hit.severity());assertEquals(text.getFirst().text(),hit.quote());}
  @Test void inventedQuotationIsRejected()throws Exception{var result=json.readTree(output("risk","paragraph:2"));((com.fasterxml.jackson.databind.node.ObjectNode)result.path("findings").get(0)).put("quote","并不存在的文字");assertThrows(IllegalArgumentException.class,()->gateway().validate(result,rules,text));}
  @Test void unknownRuleAndLocatorAreRejected()throws Exception{assertThrows(IllegalArgumentException.class,()->gateway().validate(json.readTree(output("unknown","paragraph:2")),rules,text));assertThrows(IllegalArgumentException.class,()->gateway().validate(json.readTree(output("risk","paragraph:9")),rules,text));}
  @Test void additionalDecisionFieldIsNotAccepted()throws Exception{assertThrows(IllegalArgumentException.class,()->gateway().validate(json.readTree("{\"findings\":[],\"approved\":true}"),rules,text));}
  @Test void noFindingsIsValidButDoesNotApprove()throws Exception{assertTrue(gateway().validate(json.readTree("{\"findings\":[]}"),rules,text).isEmpty());}
  @Test void disabledModelIsExplicitlyUnevaluated(){var result=gateway().analyze(rules,text,"BUYER",true);assertEquals("MODEL_UNAVAILABLE",result.mode());assertTrue(result.limitation().contains("未评估"));assertTrue(result.findings().isEmpty());}
  @Test void ruleOnlyDoesNotSendToProvider(){assertEquals("RULE_ONLY",gateway().analyze(rules,text,"BUYER",false).mode());}
  @Test void unsupportedBusinessNumbersFallBackToConfiguredSuggestion()throws Exception{
    var result=json.readTree(output("risk","paragraph:2"));
    ((com.fasterxml.jackson.databind.node.ObjectNode)result.path("findings").get(0)).put("suggestion","甲方预付30%，质保24个月。");
    var hit=gateway().validate(result,rules,text).getFirst();assertEquals("建议复核",hit.suggestion());assertTrue(hit.explanation().contains("未支持"));
  }
  @Test void inventedAttachmentNamesAreNotInserted()throws Exception{
    var result=json.readTree(output("risk","paragraph:2"));
    ((com.fasterxml.jackson.databind.node.ObjectNode)result.path("findings").get(0)).put("suggestion","按《不存在的附件清单》执行。");
    assertEquals("建议复核",gateway().validate(result,rules,text).getFirst().suggestion());
  }
  @Test void unconfiguredStatutesAndLegalDeterminationsAreNotDisplayed()throws Exception{
    var result=json.readTree(output("risk","paragraph:2"));
    ((com.fasterxml.jackson.databind.node.ObjectNode)result.path("findings").get(0)).put("explanation","依据《虚构法律》第506条，该条款无效。");
    var hit=gateway().validate(result,rules,text).getFirst();assertFalse(hit.explanation().contains("虚构法律"));assertFalse(hit.explanation().contains("506"));assertTrue(hit.explanation().contains("未采纳"));
  }
}
