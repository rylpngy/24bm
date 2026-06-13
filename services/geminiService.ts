
import { GoogleGenAI, Type } from "@google/genai";
import { suppliersData } from "../data/suppliers";

let ai: GoogleGenAI | null = null;

const getAi = () => {
  if (!ai) {
    if (!process.env.API_KEY) {
      console.warn("API_KEY is missing. AI features will not work.");
      // Return a dummy object or handle error gracefully if needed, 
      // but strictly adhering to instructions we assume it's pre-configured.
      // However, to prevent crash:
      try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY || 'dummy' });
      } catch (e) {
        console.error("Failed to initialize GoogleGenAI", e);
        throw e;
      }
    } else {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
  }
  return ai;
};

export interface SourcingResult {
  suppliers: {
    name: string;
    creditRating: string;
    matchScore: number;
    platform: string;
    advantage: string;
    potentialRisk: string;
  }[];
  strategicAdvice: string;
  detectedType?: string; // e.g., '货物', '工程', '服务'
}

export interface QuoteAnalysisResult {
  recommendedSupplier: string;
  reasoning: string;
  pros: string[];
  cons: string[];
  itemizedAnalysis?: {
    itemName: string;
    spec: string;
    qty: number;
    unit: string;
    analysis: string;
  }[];
  capabilityScores?: {
    supplier: string;
    priceScore: number;
    qualityScore: number;
    serviceScore: number;
    overallScore: number;
  }[];
}

export const smartSourcingAssistant = async (
  category: string, 
  scope: 'national' | 'platform' = 'national',
  docContext?: string
): Promise<SourcingResult> => {
  
  const scopeText = scope === 'national' ? "全网范围（包括1688、企查查、行业协会数据）" : "企业内部现有供应商库及历史合作资源";
  const contextText = docContext ? `基于解析的需求文件内容：${docContext}` : "";
  
  // Convert suppliersData to a concise string to feed to the LLM
  const availableSuppliersStr = suppliersData.map(s => 
    `ID: ${s.id}, 名称: ${s.name}, 品类: ${s.category}, 评级: ${s.level}, 状态: ${s.status}, 评分: ${s.score}`
  ).join('\n');

  const response = await getAi().models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `作为一名资深采购专家，请针对"${category}"这类物资进行智能寻源分析。
    寻源范围：${scopeText}。
    ${contextText}
    
    【重要指令】：请**必须**从以下提供的"现有供应商库"中挑选最匹配的3-4家供应商作为推荐结果。如果库中没有完全匹配的，请挑选品类最接近的。
    
    现有供应商库数据：
    ${availableSuppliersStr}
    
    请首先判断该采购属于【工程】、【货物】还是【服务】类型。
    推荐3-4家具有代表性的供应商（必须从上述库中选择），并给出信用评级、匹配度、核心优势及潜在风险。
    最后提供一段针对该品类的寻源策略建议。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          detectedType: { type: Type.STRING, description: "识别的采购类型：货物、工程或服务" },
          suppliers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "供应商全称" },
                creditRating: { type: Type.STRING, description: "信用评级，如 AAA, AA, A" },
                matchScore: { type: Type.NUMBER, description: "匹配度百分比，0-100" },
                platform: { type: Type.STRING, description: "主要数据来源平台或库内状态" },
                advantage: { type: Type.STRING, description: "核心竞争优势" },
                potentialRisk: { type: Type.STRING, description: "需要关注的潜在风险" }
              },
              required: ["name", "creditRating", "matchScore", "platform", "advantage", "potentialRisk"]
            }
          },
          strategicAdvice: { type: Type.STRING, description: "专业的寻源策略建议" }
        },
        required: ["suppliers", "strategicAdvice", "detectedType"]
      }
    },
  });

  try {
    return JSON.parse(response.text || '{}') as SourcingResult;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("寻源分析失败，请稍后重试。");
  }
};

export const evaluateQuotationsStructured = async (projectTitle: string, demand: any, quotes: any[]): Promise<QuoteAnalysisResult> => {
  const response = await getAi().models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `你是一名资深的采购总监。请分析项目 "${projectTitle}"。
    需求详情（采购标的明细）：${JSON.stringify(demand)}
    当前报价：${JSON.stringify(quotes)}
    请综合考虑TCO总成本、交期、付款方式以及供应商优势。
    请指出最推荐的一家供应商，并给出深度理由。
    同时，请在报告中体现出采购标的的明细列表（itemizedAnalysis），并针对每个标的给出简要分析。
    最后，请参考供应商的能力模型（价格、质量、售后服务等维度，满分100分），为参与报价的供应商进行综合打分（capabilityScores）。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recommendedSupplier: { type: Type.STRING, description: "被推荐的供应商完整名称" },
          reasoning: { type: Type.STRING, description: "综合分析理由" },
          pros: { type: Type.ARRAY, items: { type: Type.STRING }, description: "核心优点" },
          cons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "潜在不足/风险" },
          itemizedAnalysis: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                itemName: { type: Type.STRING, description: "标的名称" },
                spec: { type: Type.STRING, description: "规格型号" },
                qty: { type: Type.NUMBER, description: "数量" },
                unit: { type: Type.STRING, description: "单位" },
                analysis: { type: Type.STRING, description: "针对该标的的采购分析" }
              },
              required: ["itemName", "spec", "qty", "unit", "analysis"]
            },
            description: "采购标的明细列表及分析"
          },
          capabilityScores: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                supplier: { type: Type.STRING, description: "供应商名称" },
                priceScore: { type: Type.NUMBER, description: "价格得分 (0-100)" },
                qualityScore: { type: Type.NUMBER, description: "质量得分 (0-100)" },
                serviceScore: { type: Type.NUMBER, description: "售后服务得分 (0-100)" },
                overallScore: { type: Type.NUMBER, description: "综合得分 (0-100)" }
              },
              required: ["supplier", "priceScore", "qualityScore", "serviceScore", "overallScore"]
            },
            description: "供应商能力模型打分"
          }
        },
        required: ["recommendedSupplier", "reasoning", "pros", "cons", "itemizedAnalysis", "capabilityScores"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}') as QuoteAnalysisResult;
  } catch (e) {
    console.error("Analysis failed", e);
    throw new Error("AI 评估失败。");
  }
};

export const evaluateQuotations = async (projectTitle: string, quotes: any[]) => {
  const response = await getAi().models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请分析项目 "${projectTitle}" 的供应商报价数据：${JSON.stringify(quotes)}。
    请对比各家的价格、交期、服务承诺，给出最佳成交建议，并说明理由。输出要求简洁专业。`,
  });
  return response.text;
};

export const analyzeSupplierRisk = async (supplierName: string) => {
  const response = await getAi().models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请分析供应商 "${supplierName}" 的潜在经营风险、行业口碑 and 背景。请以专业采购经理的角度提供建议。`,
  });
  return response.text;
};

export const suggestSourcingStrategy = async (itemCategory: string) => {
  const response = await getAi().models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `针对 "${itemCategory}" 类别物资，请建议最佳的采购寻源策略（询价、竞价或商城）并给出理由。`,
  });
  return response.text;
};

export const generateProcurementReport = async (data: any) => {
    const response = await getAi().models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `基于以下采购数据，提供一份月度分析总结和优化建议：${JSON.stringify(data)}`,
    });
    return response.text;
}

// New Functions for Project Management

export const analyzeProcurementNeeds = async (needs: any[]) => {
  const response = await getAi().models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `作为采购计划专家，请分析以下来自不同部门的采购需求：${JSON.stringify(needs)}。
    请给出需求合并建议，将同类物资（如办公用品、MRO等）进行归类打包，并指出哪些需求可以合并采购以降低成本。
    请以JSON格式返回：{ "summary": "分析摘要", "suggestions": [{ "category": "分类", "items": ["Item A", "Item B"], "reason": "合并理由" }] }`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || '{}');
}

export const generatePlanStrategy = async (items: any[], totalBudget: number) => {
  const availableSuppliersStr = suppliersData.map(s => 
    `ID: ${s.id}, 名称: ${s.name}, 品类: ${s.category}, 评级: ${s.level}, 状态: ${s.status}, 评分: ${s.score}`
  ).join('\n');

  const response = await getAi().models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `基于采购内容：${JSON.stringify(items)} 和总预算 ¥${totalBudget}。
    1. 推荐最佳采购方式（询价/竞价/招标/协议/商城）。
    2. 推荐3个潜在供应商（【重要指令】：必须从以下提供的"现有供应商库"中挑选最匹配的3家供应商，如果库中没有完全匹配的，请挑选品类最接近的）。
    3. 给出策略理由。
    
    现有供应商库数据：
    ${availableSuppliersStr}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          method: { type: Type.STRING, description: "推荐采购方式" },
          reason: { type: Type.STRING, description: "策略理由" },
          recommendedSuppliers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "推荐供应商列表" },
          riskAssessment: { type: Type.STRING, description: "合规风险提示" }
        },
        required: ["method", "reason", "recommendedSuppliers", "riskAssessment"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
}

export const auditApproval = async (docType: 'need' | 'plan', content: any) => {
  const response = await getAi().models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `你是一个企业的内控合规AI助手。请审核以下${docType === 'need' ? '采购需求' : '采购方案'}：
    ${JSON.stringify(content)}。
    请检查预算合理性、流程合规性。
    返回JSON: { "status": "pass" | "warning" | "reject", "confidence": number (0-100), "comment": "审核意见", "highlight": "需要注意的点" }`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text || '{}');
}
