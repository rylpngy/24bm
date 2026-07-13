import { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';
import { cn } from '../lib/cn';

export interface SignaturePadProps {
  /** 签名变化:有笔迹时回传 PNG data URL,清除后回传 null。 */
  onChange: (dataUrl: string | null) => void;
  height?: number;
  className?: string;
}

/** 手写签名板:canvas 笔迹采集(鼠标/触屏),输出 PNG data URL;空白时不产生签名。 */
export function SignaturePad({ onChange, height = 140, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // 按容器实际宽度与设备像素比初始化画布,保证笔迹清晰。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
    }
  }, [height]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    const p = point(e);
    ctx?.beginPath();
    ctx?.moveTo(p.x, p.y);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const p = point(e);
    ctx?.lineTo(p.x, p.y);
    ctx?.stroke();
  };

  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setHasInk(true);
    onChange(canvasRef.current?.toDataURL('image/png') ?? null);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border border-slate-200 bg-white', className)}>
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5">
        <p className="flex items-center gap-1.5 text-xs font-black text-slate-500">
          <PenLine size={13} /> 手写签名(鼠标 / 触屏书写)
        </p>
        <button
          type="button"
          onClick={clear}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-black text-slate-500 hover:bg-slate-50"
        >
          <Eraser size={12} /> 清除重签
        </button>
      </div>
      <div className="relative">
        {!hasInk && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-300">
            请在此区域手写签名
          </p>
        )}
        <canvas
          ref={canvasRef}
          data-testid="signature-canvas"
          style={{ width: '100%', height, touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
      </div>
    </div>
  );
}

export interface EsignRecordItem {
  id?: string;
  signerScope?: string;
  signerId?: string;
  signerName?: string;
  enterpriseId?: string;
  contentDigest?: string;
  signatureImage?: string;
  signedAt?: string;
  remark?: string;
}

const SCOPE_LABEL: Record<string, string> = { BUYER: '采购方签章', SUPPLIER: '供应商签署' };

/** 电子签署记录列表:签署方 / 时间 / 内容指纹(防篡改) / 签名笔迹。 */
export function EsignRecordList({ records }: { records: EsignRecordItem[] }) {
  if (records.length === 0) {
    return <p className="text-xs font-bold text-slate-400">暂无电子签署记录。</p>;
  }
  return (
    <div className="space-y-2">
      {records.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-black text-emerald-800">
              {SCOPE_LABEL[r.signerScope ?? ''] ?? r.signerScope}
              <span className="ml-1.5 text-slate-600">{r.signerName || r.signerId}</span>
            </p>
            <p className="mt-0.5 font-mono text-[11px] font-bold text-slate-400">
              {r.signedAt ? `${r.signedAt.slice(0, 10)} ${r.signedAt.slice(11, 19)}` : '—'}
              {r.contentDigest && (
                <span className="ml-2" title={`单据内容指纹(SHA-256):${r.contentDigest}`}>
                  指纹 {r.contentDigest.slice(0, 16)}…
                </span>
              )}
            </p>
          </div>
          {r.signatureImage && (
            <img
              src={r.signatureImage}
              alt="签名笔迹"
              className="h-10 max-w-[10rem] shrink-0 rounded-md border border-slate-200 bg-white object-contain px-1"
            />
          )}
        </div>
      ))}
    </div>
  );
}
