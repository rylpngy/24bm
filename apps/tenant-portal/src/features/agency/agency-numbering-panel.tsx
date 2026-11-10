import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { agencyRequest, type AgencyNumbering } from "@24bid/api-client";
import { FeedbackNotice } from "@24bid/ui";
const input =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm";
export function AgencyNumberingPanel({ value }: { value: AgencyNumbering }) {
  const client = useQueryClient(),
    [pattern, setPattern] = useState(value.pattern),
    [categories, setCategories] = useState<[string, string][]>(
      Object.entries(JSON.parse(value.categories)),
    ),
    [objects, setObjects] = useState<[string, string][]>(
      Object.entries(JSON.parse(value.objects)),
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState<{
      tone: "error" | "success";
      message: string;
    } | null>(null);
  const rows = (
    title: string,
    values: [string, string][],
    set: (v: [string, string][]) => void,
  ) => (
    <section>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      {values.map(([code, name], i) => (
        <div key={i} className="mb-2 flex gap-2">
          <input
            aria-label={title + "代码" + (i + 1)}
            className={input}
            value={code}
            onChange={(e) =>
              set(
                values.map((v, n) =>
                  n === i ? [e.target.value.toUpperCase(), v[1]] : v,
                ),
              )
            }
          />
          <input
            aria-label={title + "名称" + (i + 1)}
            className={input}
            value={name}
            onChange={(e) =>
              set(values.map((v, n) => (n === i ? [v[0], e.target.value] : v)))
            }
          />
          <button
            className="shrink-0 text-xs text-slate-500"
            onClick={() => set(values.filter((_, n) => n !== i))}
          >
            移除
          </button>
        </div>
      ))}
      <button
        className="text-sm text-blue-700"
        onClick={() => set([...values, ["", ""]])}
      >
        添加分类
      </button>
    </section>
  );
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (
        new Set(categories.map((v) => v[0])).size !== categories.length ||
        new Set(objects.map((v) => v[0])).size !== objects.length
      )
        throw Error("分类代码不能重复");
      await agencyRequest("/numbering", "PUT", {
        expectedVersion: value.version,
        pattern,
        timeZone: value.timeZone,
        categories: Object.fromEntries(categories),
        objects: Object.fromEntries(objects),
      });
      await client.invalidateQueries({ queryKey: ["agency-options"] });
      setMessage({
        tone: "success",
        message: "编号规则已保存，原有编号保持不变。",
      });
    } catch (e) {
      setMessage({
        tone: "error",
        message:
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="mb-4 rounded-lg border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        公司年度编号设置
      </summary>
      <fieldset disabled={busy} className="mt-4 space-y-4">
        <label className="grid gap-2 text-sm">
          编号格式
          <input
            className={input}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
        </label>
        <p className="text-xs text-slate-500">
          {"{category}"} 类别 · {"{object}"} 对象 · {"{yyyyMM}"} 年月 ·{" "}
          {"{serial}"} 四位年度流水。跨月及分类共享流水。业务时区：
          {value.timeZone}。
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          {rows("业务类别", categories, setCategories)}
          {rows("采购对象", objects, setObjects)}
        </div>
        {message && <FeedbackNotice {...message} />}
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
          onClick={() => void save()}
        >
          {busy ? "保存中…" : "保存编号规则"}
        </button>
      </fieldset>
    </details>
  );
}
