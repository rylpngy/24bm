# Partial fulfillment boundary

- Shipment and receipt transactions lock the tenant-scoped purchase order before
  reading cumulative line quantities. All batches share this parent lock.
- Shipment lines identify real order lines. Receipt lines identify those same
  order lines and cannot consume more than cumulative shipped or ordered amounts.
- Document headers remain integer quantities; individual quantities have at most
  two decimal places, matching the existing order/receipt database columns.
  Header totals must match exact line totals; no rounding is performed.
- Subsequent batches retain `已发货`; only full physical receipt of every order
  line transitions to `已收货`. This status is not a quality/payment authorization.
- Missing request lines are compatible only with an exact full remaining order
  balance. Receipt mapping additionally requires enough shipment on every line
  and an unambiguous all-qualified or all-rejected total. Partial or mixed-quality
  headers must provide explicit lines.
- Orders with no real lines, or historical headers/lines that cannot be reconciled,
  are read-only for quantitative fulfillment. Existing records are never rewritten
  or assigned inferred quantities. New smoke fixtures use demand/quote/order lines.
- Recorded shipment quantities cannot be edited through tracking maintenance.
- Receipt quality conclusions reject nonpositive received amounts and invalid
  qualified amounts, even when called outside HTTP bean validation.

## Disposition Review

The current cumulative quantities are physical shipment/receipt quantities, not
net accepted quantities. No replacement shipment credit or qualification override
is silently applied. A return/replacement disposition therefore does not restore
shipment capacity in this change.

V222 adds one immutable review per original negative receipt. POST requires both
`buyer:receipt:manage` and `buyer:workflow:review`, receipt/order data scope, and an
explicit decision (`让步接收` or `维持退货换货`), reason, and evidence reference. The
original receipt must still have a return/replacement disposition. Neither head
nor line qualified quantities are overwritten; no reviewed quantity is invented.
Only an explicit concession is evidence of accepted disposition, equivalent to
an original concession for downstream effective acceptance. Maintaining return/
replacement leaves the negative evidence blocking. Finance and archive owners
consume this table separately; order status alone does not authorize payment.

Locks are acquired in RFQ/order/receipt/invoice/contract order. Existing payment
entries (including partially paid or reversed history), nonpending invoice payment
statuses, contract archives, and procurement execution archives conservatively
block a new review. Identical retries return the original immutable record even
after closeout; conflicting retries are rejected. No inventory, refund, automatic
replacement shipment, or physical return lifecycle is included.

GET/POST `/api/v1/buyer/receipts/{receiptId}/disposition-review` uses request fields
`decision`, `reason`, `evidenceNo`; GET returns `data: null` before a review exists.
The persisted reviewer fields are `reviewed_by`, `reviewed_at`, and `evidence_no`,
serialized as `reviewedBy`, `reviewedAt`, and `evidenceNo`. GET requires receipt
read permission and the same order data scope.

## Integration

`CreateDeliveryRequest.lineItems` and `DeliveryResponse.lineItems` use
`[{ orderLineId, shippedQuantity }]`. Receipt requests retain
`[{ orderLineId, receivedQuantity, qualifiedQuantity }]`.
Shared generated API models and external execution/finance aggregates belong to
the parent coordinator. Order UI uses the additive delivery fields structurally
until the parent regenerates the API client.

Run `OrderPartialFulfillmentPostgresIT` explicitly: it requires Docker/PostgreSQL
and includes real concurrent shipment/receipt transactions and rollback checks.
