import { useState } from "react";
export type LifecycleField = {
  key: string;
  label: string;
  type?: "text" | "long" | "time" | "amount" | "select";
  options?: [string, string][];
  optional?: boolean;
};
export function LifecycleForm({
  title,
  fields,
  basis,
  busy,
  submit,
  initial = {},
}: {
  title: string;
  fields: LifecycleField[];
  basis: string;
  busy: boolean;
  submit: (values: Record<string, string>) => Promise<boolean>;
  initial?: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial),
    [ack, setAck] = useState("");
  const stamp = JSON.stringify([values, basis]);
  return (
    <form
      className="space-y-2 rounded border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (ack === stamp)
          void submit(values).then((ok) => {
            if (ok) setAck("");
          });
      }}
    >
      <h5 className="font-semibold">{title}</h5>
      <fieldset disabled={busy} className="space-y-2">
        {fields.map((f) => (
          <label className="block text-sm" key={f.key}>
            {f.label}
            {f.optional ? "（如适用）" : ""}
            {f.type === "select" ? (
              <select
                aria-label={f.label}
                className="w-full rounded border p-2"
                required={!f.optional}
                value={values[f.key] || ""}
                onChange={(e) => {
                  setValues({ ...values, [f.key]: e.target.value });
                  setAck("");
                }}
              >
                <option value="">请选择</option>
                {f.options?.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            ) : f.type === "long" ? (
              <textarea
                aria-label={f.label}
                className="w-full rounded border p-2"
                required={!f.optional}
                value={values[f.key] || ""}
                onChange={(e) => {
                  setValues({ ...values, [f.key]: e.target.value });
                  setAck("");
                }}
              />
            ) : (
              <input
                aria-label={f.label}
                className="w-full rounded border p-2"
                required={!f.optional}
                type={f.type === "time" ? "datetime-local" : "text"}
                inputMode={f.type === "amount" ? "decimal" : undefined}
                value={values[f.key] || ""}
                onChange={(e) => {
                  setValues({ ...values, [f.key]: e.target.value });
                  setAck("");
                }}
              />
            )}
          </label>
        ))}
        <label className="block text-sm">
          <input
            type="checkbox"
            checked={ack === stamp}
            onChange={(e) => setAck(e.target.checked ? stamp : "")}
          />
          已核对当前版本、办理权限、真实材料与本次操作范围
        </label>
        <button
          className="rounded border px-3 py-2 text-sm disabled:opacity-40"
          disabled={busy || ack !== stamp}
        >
          {title}
        </button>
      </fieldset>
    </form>
  );
}
export const asTime = (v: string | undefined) =>
  v ? new Date(v).toISOString() : null;
