-- 采购预算与财务预算使用不同的表述；同时统一历史“行政”使用方向文案。
update ludong_poc_review_records
set review_data = jsonb_set(
      review_data,
      '{procurementBudgetStatus}',
      to_jsonb(case review_data ->> 'procurementBudgetStatus'
        when '本项目已列入本年度学校预算' then '本项目已列入本年度采购预算'
        when '本项目已列入本年度预算' then '本项目已列入本年度采购预算'
        when '本项目年初无预算，现已办理预算追加手续' then '本项目年初无采购预算，现已办理采购预算追加手续'
        when '本项目本年度无预算，已列入下一年度预算' then '本项目本年度无采购预算，已列入下一年度采购预算'
        else review_data ->> 'procurementBudgetStatus'
      end),
      false)
where node_id = 'procurement_budget_review'
  and review_data ? 'procurementBudgetStatus';

update ludong_poc_applications
set items = coalesce((
      select jsonb_agg(case
        when item ->> 'usageDirection' = '行政'
          then jsonb_set(item, '{usageDirection}', '"行政办公"'::jsonb, false)
        else item
      end)
      from jsonb_array_elements(items) as item
    ), '[]'::jsonb),
    updated_at = now()
where exists (
  select 1
  from jsonb_array_elements(items) as item
  where item ->> 'usageDirection' = '行政'
);
