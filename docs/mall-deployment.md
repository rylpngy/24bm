# 商城直采版 · 独立部署指南

面向"只要商城直采"的企业客户。与完整版**同一份代码、同一个后端镜像**,通过部署形态与租户能力两层开关裁剪。

## 一、这一版包含什么

| 能力 | 商城版 | 说明 |
|---|---|---|
| 商城商品目录 | ✅ | 商品 / 多规格 SKU / 分类 / 图集 / 阶梯价 / 起订量 / 库存 / 交期 |
| 商城门户 | ✅ | 首页、分类页、商品详情、购物车、结算、我的订单(端口 5176) |
| 供应商门户 | ✅ | 上架商品与定价、发货、对账、资质(端口 5175) |
| 订单履约 | ✅ | 采购订单 → 发货 → 收货验收 |
| 发票与付款 | ✅ | 发票、付款、三单匹配对账 |
| 主数据与组织 | ✅ | 物料、供应商准入、部门、成员与权限 |
| 平台运营端 | 可选 | 开通租户与账号、审核供应商企业、配置采购方式(端口 5174,`--profile admin`) |
| 询比 / 竞价 | ❌ | 接口面关闭(HTTP 404),菜单不出现 |
| 招标 | ❌ | 同上 |

## 二、两层开关

1. **部署形态**(`APP_DEPLOYMENT_PROFILE=mall`):关闭寻源与招标的 HTTP 接口面。
   实现见 `DeploymentSurfaceFilter`;裁剪的是**对外接口面**,不是 Bean 装配——
   商城下单内部仍要调用寻源上下文的锚点 RFQ 服务,因此内存占用与完整版一致。
2. **租户能力**(`tenants.enabled_features` 里只勾 `method:mall`):业务层在立项入口拒绝
   未开通的采购方式。即便有人绕过前端直接调 API,也会被拒。

两层都做,是因为它们防的不是同一件事:形态开关关的是"这套部署卖的是什么",
能力开关关的是"这个租户买了什么"。

## 三、部署步骤

```bash
cd infra
docker compose -f docker-compose.mall.yml --profile app --profile portals up -d --build
```

首次部署还需要开通租户与账号,启用平台端一次即可:

```bash
docker compose -f docker-compose.mall.yml --profile admin up -d --build
```

访问 `http://localhost:5174`,用平台管理员登录后:

1. 新建租户(采购企业),在「采购方式(可自由组合)」里**只勾选「商城直采」**;
2. 审核并准入供应商企业;
3. 通知供应商登录 `http://localhost:5175` 上架商品并定价;
4. 采购方成员访问 `http://localhost:5176` 浏览、加购、下单。

开通完成后可停掉平台端容器,只保留 app + 两个门户。

### 生产前必须调整

| 变量 | 默认 | 生产要求 |
|---|---|---|
| `JWT_SECRET` | 空 | 必填(配合 `ALLOW_DEMO_JWT_SECRET=false`,缺失则启动即失败) |
| `ALLOW_DEMO_JWT_SECRET` | `true` | 置 `false` |
| `SELF_LOGIN_ENABLED` | `true` | 置 `false`,登录统一走 Keycloak |
| `APP_SEED_LOCATIONS` | 空 | 保持为空(不灌演示数据);仅演示环境用 `classpath:db/demo` |
| `CORS_ALLOWED_ORIGINS` | 本地端口 | 改为真实域名 |
| `DB_PASSWORD` / `MINIO_ROOT_PASSWORD` / `KEYCLOAK_ADMIN_PASSWORD` | 演示值 | 全部替换 |

## 四、升级

商城版与完整版共用同一条 Flyway 迁移链,升级即拉新镜像重启,不需要单独的迁移分支。
商城版数据库里会存在寻源/招标相关的空表——它们不占业务成本,换取的是**不分叉代码库**:
同一次修复与升级同时覆盖两种形态。

## 五、以后想开通其他采购方式

无需换部署包:

1. 后端 `APP_DEPLOYMENT_PROFILE` 改回 `full`(或删除该变量)并重启;
2. 平台端给该租户勾选需要的采购方式;
3. 起对应的采购方工作台门户(`docker-compose.yml` 的 `tenant-portal`)。

数据不用迁移——商城期间产生的商品、订单、发票在完整版里是同一套表。
