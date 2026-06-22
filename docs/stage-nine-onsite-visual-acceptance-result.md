# 阶段九现场视觉复跑结果

生成时间：2026-06-21T11:16:55.940Z

## 验收命令

`node scripts/stage-nine-onsite-visual-acceptance-check.mjs`

## 结论

- 数据源：Java 数据源
- 页面组合：6
- 失败项：0
- 覆盖视口：desktop-1280x720、mobile-390x844
- 覆盖入口：采购方阶段九演示入口、供应商阶段九演示入口、平台端阶段九演示入口
- 演示准备检查面板可见，无整页横向溢出，控制台 error 为 0。

## 截图证据

| 角色 | 模块 | 视口 | 截图 | 结果 |
| --- | --- | --- | --- | --- |
| 采购方阶段九演示入口 | demands | desktop-1280x720 | `docs/artifacts/stage-nine-onsite-buyer-demands-desktop-1280x720.png` | 通过 |
| 采购方阶段九演示入口 | demands | mobile-390x844 | `docs/artifacts/stage-nine-onsite-buyer-demands-mobile-390x844.png` | 通过 |
| 供应商阶段九演示入口 | opportunities | desktop-1280x720 | `docs/artifacts/stage-nine-onsite-supplier-opportunities-desktop-1280x720.png` | 通过 |
| 供应商阶段九演示入口 | opportunities | mobile-390x844 | `docs/artifacts/stage-nine-onsite-supplier-opportunities-mobile-390x844.png` | 通过 |
| 平台端阶段九演示入口 | tenants | desktop-1280x720 | `docs/artifacts/stage-nine-onsite-platform-tenants-desktop-1280x720.png` | 通过 |
| 平台端阶段九演示入口 | tenants | mobile-390x844 | `docs/artifacts/stage-nine-onsite-platform-tenants-mobile-390x844.png` | 通过 |

## 检查项

- Java 数据源可见。
- 阶段九演示总线可见。
- 演示准备检查面板可见。
- 页面无“加载失败”、`argument type mismatch`、React runtime error。
- 控制台 error 为 0。
- 无整页横向溢出。
