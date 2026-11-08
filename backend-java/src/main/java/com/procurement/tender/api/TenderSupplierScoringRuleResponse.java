package com.procurement.tender.api;
import com.procurement.tender.domain.TenderScoringWeights;
public record TenderSupplierScoringRuleResponse(String evaluationMethod,int revision,TenderScoringWeights weights) {}
