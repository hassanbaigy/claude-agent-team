# Money invariants — non-negotiable rules

Money is more correctness-sensitive than any other surface in your system. Every rule below is non-negotiable.

## Integers only, never floats

Store amounts as integer minor units:
- USD/EUR/GBP: cents (×100)
- JPY: yen (×1 — no minor unit)
- BTC: satoshis (×100,000,000)
- ETH: wei (×10^18)

Floats break:

```python
>>> 0.1 + 0.2
0.30000000000000004
>>> 0.1 + 0.2 == 0.3
False
```

Over thousands of transactions you accumulate cent-level invariant violations that are EXTREMELY painful to reconcile after the fact.

## Currency code on every amount

Two columns, always together:

```sql
amount_minor BIGINT NOT NULL,
currency CHAR(3) NOT NULL  -- ISO 4217: 'USD', 'EUR', 'JPY', ...
```

Never compute on amounts with different currencies. Convert via an explicit step with a recorded exchange rate.

## Decimal arithmetic when you must

If you HAVE to do math on fractional amounts (interest, tax, currency conversion), use the language's decimal type, not float:

```python
from decimal import Decimal, ROUND_HALF_EVEN

amount = Decimal("19.99")
tax = (amount * Decimal("0.0875")).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN)
```

```typescript
// Use bigint or a decimal library; never JS number for money math
import Decimal from "decimal.js";
const tax = new Decimal("19.99").mul("0.0875").toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
```

## Banker's rounding (ROUND_HALF_EVEN)

Default to banker's rounding for tax, interest, splits. Statistically symmetric — over many rounding events, the cumulative bias is zero. `ROUND_HALF_UP` introduces a small positive bias that compounds.

## Sum in the database, not the client

```sql
-- RIGHT
SELECT SUM(amount_minor) FROM transactions WHERE ...

-- WRONG
SELECT amount_minor FROM transactions WHERE ...
-- then client iterates and adds
```

Postgres int8 SUM is exact. JS sum on number is float, exact only up to 2^53. For large ledgers, client-side summation produces wrong totals silently.

## Comparison must be exact integer equality

```python
# RIGHT
if charge_amount == invoice_amount:

# WRONG  (in any language with floats)
if abs(charge_amount - invoice_amount) < 0.01:
```

The "approximately equal" pattern is the symptom — if you find yourself writing it, you're storing money as float.

## Foreign exchange: record the rate at the moment of the transaction

Never recompute historical balances using today's FX rate. Every cross-currency transaction needs:

```sql
amount_source_minor BIGINT,
currency_source CHAR(3),
amount_target_minor BIGINT,
currency_target CHAR(3),
exchange_rate NUMERIC(20, 10),
exchange_rate_at TIMESTAMPTZ,
rate_provider TEXT
```

Six months later when accounting reconciles, this is the only way to reconstruct what actually happened.

## Negative amounts: signed integer, signed semantics

Charges are positive, refunds are negative. Sum across a customer = balance. Don't store refunds as separate `refunded_amount` columns — that breaks aggregation.

## Display ≠ storage

The user sees "$19.99" — you store `1999, 'USD'`. Format at the display layer only. Never persist the display string.
