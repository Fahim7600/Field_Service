CREATE SEQUENCE IF NOT EXISTS service_request_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE UNIQUE INDEX "invoices_one_main_per_work_order"
  ON "invoices" ("workOrderId") WHERE "type" = 'MAIN' AND "status" <> 'VOID';

CREATE UNIQUE INDEX "subscriptions_one_active_per_customer"
  ON "subscriptions" ("customerId") WHERE "status" = 'ACTIVE';

ALTER TABLE "feedback" ADD CONSTRAINT "feedback_rating_range"
  CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_money_non_negative"
  CHECK ("laborCents" >= 0 AND "partsCents" >= 0 AND "extraCents" >= 0
    AND "discountCents" >= 0 AND "taxCents" >= 0 AND "totalCents" >= 0);

ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_valid_amounts"
  CHECK ("unitAmountCents" >= 0 AND "amountCents" >= 0 AND "quantity" > 0);

ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_non_negative"
  CHECK ("amountCents" >= 0);

ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_price_non_negative"
  CHECK ("basePriceCents" >= 0);

ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_price_non_negative"
  CHECK ("priceCents" >= 0);

ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_visit_window_valid"
  CHECK ("visitStart" IS NULL OR "visitEnd" IS NULL OR "visitEnd" > "visitStart");