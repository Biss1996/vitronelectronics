-- Orders placed while delivery fees are switched off: the fee is agreed on the confirmation call.
ALTER TABLE orders ADD COLUMN delivery_fee_pending BOOLEAN NOT NULL DEFAULT FALSE;
