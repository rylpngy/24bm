package com.procurement;

import com.procurement.contract.api.ContractReviewContracts.Rule;
import com.procurement.contract.application.*;
import com.procurement.attachment.application.AttachmentTextExtractor.Segment;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ContractReviewEngineTests {
  Rule rule(String id,String type,String perspective,String mode,List<String> keys){return new Rule(id,"测试规则",type,perspective,"HIGH",mode,keys,"内部演示依据","第一条","人工复核要求","建议条款");}
  final ContractReviewEngine engine=new ContractReviewEngine();
  @Test void perspectivesDoNotLeakRules(){var rules=List.of(rule("buyer","KEYWORD","BUYER","ANY",List.of("预付")),rule("seller","KEYWORD","SELLER","ANY",List.of("预付")));
    assertEquals("buyer",engine.check(rules,List.of(new Segment("line:1","预付100%")),"BUYER").getFirst().ruleId());
    assertEquals("seller",engine.check(rules,List.of(new Segment("line:1","预付100%")),"SELLER").getFirst().ruleId());}
  @Test void allRequiresEveryKeywordInOneParagraph(){var rule=rule("all","KEYWORD","BOTH","ALL",List.of("预付","100%"));
    assertTrue(engine.check(List.of(rule),List.of(new Segment("line:1","预付30%"),new Segment("line:2","100%验收")),"BUYER").isEmpty());
    var hit=engine.check(List.of(rule),List.of(new Segment("line:4","付款预付100%")),"BUYER").getFirst();assertEquals("line:4",hit.locator());assertEquals("付款预付100%",hit.quote());assertEquals("内部演示依据",hit.sourceName());}
  @Test void missingDoesNotFabricateAnOriginalLocator(){var rule=rule("missing","MISSING","BOTH","ANY",List.of("保密","商业秘密"));
    var hit=engine.check(List.of(rule),List.of(new Segment("line:1","采购设备")),"BUYER").getFirst();assertNull(hit.locator());assertEquals("",hit.quote());
    assertTrue(engine.check(List.of(rule),List.of(new Segment("line:1","保密义务")),"BUYER").isEmpty());}
  @Test void semanticRulesAreNeverPretendedToBeLocalInference(){assertTrue(engine.check(List.of(rule("semantic","SEMANTIC","BOTH","ANY",List.of())),List.of(new Segment("p1","任何内容")),"BUYER").isEmpty());}
  @Test void duplicateRuleIdentifiersAreRejected(){var rule=rule("same","MISSING","BOTH","ANY",List.of("保密"));assertThrows(IllegalArgumentException.class,()->ContractReviewRulesService.validate(List.of(rule,rule)));}
  @Test void invalidEnumsAndEmptyKeywordsAreRejected(){assertThrows(IllegalArgumentException.class,()->ContractReviewRulesService.validate(List.of(rule("bad","REGEX","BOTH","ANY",List.of("a")))));
    assertThrows(IllegalArgumentException.class,()->ContractReviewRulesService.validate(List.of(rule("bad","KEYWORD","BOTH","ANY",List.of()))));}
}
