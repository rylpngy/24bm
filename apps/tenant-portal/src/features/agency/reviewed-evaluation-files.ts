export const reviewedEvaluationLabels: Record<string, string> = {
  expert_scores: '专家评分表',
  score_summary: '评分汇总表',
  evaluation_report: '评标报告',
  signed_material: '签署材料',
};

export type ReviewedEvaluationFile = {
  kind: string;
  versionId: string;
  ordinal: number;
  sha256: string;
};
