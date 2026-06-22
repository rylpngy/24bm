# 阶段七现场视觉验收结果

生成时间：2026-06-21T07:39:34.542Z

## 验收命令

`node scripts/stage-seven-onsite-visual-acceptance-check.mjs`

## 结论

- 数据源：Java 数据源
- 页面组合：4
- 失败项：0
- 覆盖视口：desktop-1280x720、mobile-390x844
- 覆盖入口：采购方演示入口、供应商演示入口
- 无整页横向溢出，控制台 error 为 0。

## 截图证据

| 角色 | 模块 | 视口 | 截图 | 结果 |
| --- | --- | --- | --- | --- |
| 采购方演示入口 | demands | desktop-1280x720 | `docs/artifacts/stage-seven-onsite-buyer-demands-desktop-1280x720.png` | 通过 |
| 采购方演示入口 | demands | mobile-390x844 | `docs/artifacts/stage-seven-onsite-buyer-demands-mobile-390x844.png` | 通过 |
| 供应商演示入口 | opportunities | desktop-1280x720 | `docs/artifacts/stage-seven-onsite-supplier-opportunities-desktop-1280x720.png` | 通过 |
| 供应商演示入口 | opportunities | mobile-390x844 | `docs/artifacts/stage-seven-onsite-supplier-opportunities-mobile-390x844.png` | 通过 |

## 检查项

- Java 数据源可见。
- 页面无“加载失败”、`argument type mismatch`、React runtime error。
- 控制台 error 为 0。
- 无整页横向溢出。
