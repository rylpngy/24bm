/**
 * 商城采购:租户协议价货架(供应商 + 物料 + 协议单价)与目录直购下单。
 * 边界:货架商品的上下架与检索归本模块;直购订单经 sourcing/order 的应用层入口生成
 * (商城锚点 RFQ + 采购订单),不直接触碰其他模块的基础设施。
 *
 * @since MVP
 */
package com.procurement.mall;
