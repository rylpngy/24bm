package com.procurement.contract.application;

import com.procurement.attachment.application.AttachmentTextExtractor.Segment;
import com.procurement.contract.api.ContractReviewContracts.*;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class ContractReviewEngine {
  public List<Finding> check(List<Rule> rules,List<Segment> segments,String perspective){
    List<Finding> result=new ArrayList<>();
    for(var rule:rules){
      if(!applies(rule,perspective)||"SEMANTIC".equals(rule.type()))continue;
      if("MISSING".equals(rule.type())){
        String body=String.join("\n",segments.stream().map(Segment::text).toList());
        if(!matches(rule,body))result.add(finding(rule,null,"","全文未检出规则要求的约定，须人工确认是否确实缺失。",rule.suggestion(),"RULE"));
      }else for(var segment:segments){
        if(matches(rule,segment.text()))result.add(finding(rule,segment.locator(),segment.text(),"原文命中已发布规则的"+("ALL".equals(rule.matchMode())?"全部":"任一")+"关键词，须人工复核。",rule.suggestion(),"RULE"));
        if(result.size()>=120)return List.copyOf(result);
      }
    }
    return List.copyOf(result);
  }
  private boolean matches(Rule rule,String text){
    String value=text.toLowerCase(Locale.ROOT);
    return "ALL".equals(rule.matchMode())?rule.keywords().stream().allMatch(k->value.contains(k.toLowerCase(Locale.ROOT))):rule.keywords().stream().anyMatch(k->value.contains(k.toLowerCase(Locale.ROOT)));
  }
  public static boolean applies(Rule rule,String perspective){return "BOTH".equals(rule.perspective())||perspective.equals(rule.perspective());}
  public static Finding finding(Rule rule,String locator,String quote,String explanation,String suggestion,String origin){
    return new Finding("finding-"+UUID.randomUUID(),rule.id(),rule.title(),rule.severity(),origin,locator,quote,explanation,suggestion,rule.sourceName(),rule.clause(),rule.basis());
  }
}
