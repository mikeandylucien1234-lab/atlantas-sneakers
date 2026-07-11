// Centralized tax calculation engine.
// The single source of truth for all tax math across checkout, orders and admin.
// Never duplicate this logic elsewhere — import calculateTaxes() instead.

export type TaxRule = {
  id: string;
  name: string;
  tax_type: string;
  value_type: "percentage" | "fixed";
  inclusive: boolean;
  rate: number;
  country: string | null;
  state: string | null;
  city: string | null;
  postal_code: string | null;
  applies_to: string;
  target_category_ids?: string[];
  target_brand_ids?: string[];
  target_product_ids?: string[];
  customer_type: string;
  min_order?: number | null;
  max_order?: number | null;
  priority: number;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
};

export type TaxLineItem = {
  product_id?: string;
  category_id?: string;
  brand_id?: string;
  is_digital?: boolean;
  price: number;      // unit price
  quantity: number;
};

export type TaxContext = {
  country?: string | null;
  state?: string | null;
  city?: string | null;
  postal_code?: string | null;
  customer_type?: string;   // guest | registered | business | wholesale | vip
  items: TaxLineItem[];
  subtotal?: number;        // optional pre-computed subtotal
  now?: Date;
};

export type AppliedTax = {
  tax_id: string;
  tax_name: string;
  tax_type: string;
  value_type: "percentage" | "fixed";
  inclusive: boolean;
  rate: number;
  taxable_base: number;
  tax_amount: number;
  country: string | null;
  state: string | null;
  priority: number;
  timestamp: string;
};

export type TaxResult = {
  taxes: AppliedTax[];
  totalTax: number;          // total tax to ADD (exclusive taxes only)
  inclusiveTax: number;      // tax already contained in prices (informational)
  taxableSubtotal: number;
};

function ci(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Does a rule's geography match the destination? Empty rule fields = wildcard.
function matchesRegion(rule: TaxRule, ctx: TaxContext): boolean {
  if (rule.country && !ci(rule.country, ctx.country)) return false;
  if (rule.state && !ci(rule.state, ctx.state)) return false;
  if (rule.city && !ci(rule.city, ctx.city)) return false;
  if (rule.postal_code && !ci(rule.postal_code, ctx.postal_code)) return false;
  return true;
}

function matchesCustomer(rule: TaxRule, ctx: TaxContext): boolean {
  if (!rule.customer_type || rule.customer_type === "all") return true;
  return rule.customer_type === (ctx.customer_type || "guest");
}

function isActive(rule: TaxRule, now: Date): boolean {
  if (rule.status !== "active") return false;
  if (rule.start_date && new Date(rule.start_date) > now) return false;
  if (rule.end_date && new Date(rule.end_date) < now) return false;
  return true;
}

// Which line items does this rule apply to?
function taxableItemsFor(rule: TaxRule, items: TaxLineItem[]): TaxLineItem[] {
  switch (rule.applies_to) {
    case "physical": return items.filter(i => !i.is_digital);
    case "digital": return items.filter(i => i.is_digital);
    case "specific_categories": {
      const set = new Set(rule.target_category_ids || []);
      return items.filter(i => i.category_id && set.has(i.category_id));
    }
    case "specific_brands": {
      const set = new Set(rule.target_brand_ids || []);
      return items.filter(i => i.brand_id && set.has(i.brand_id));
    }
    case "specific_products": {
      const set = new Set(rule.target_product_ids || []);
      return items.filter(i => i.product_id && set.has(i.product_id));
    }
    case "all":
    default: return items;
  }
}

/**
 * Calculate all applicable taxes for a cart/order.
 * - Respects rule priority (lower number applied first)
 * - Supports percentage and fixed-amount taxes
 * - Supports inclusive (tax already in price) and exclusive (added on top) taxes
 * - Supports multiple simultaneous taxes on one order
 * - Honours min/max order thresholds, region, customer type and validity dates
 */
export function calculateTaxes(rules: TaxRule[], ctx: TaxContext): TaxResult {
  const now = ctx.now || new Date();
  const timestamp = now.toISOString();
  const subtotal = ctx.subtotal ?? ctx.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const eligible = rules
    .filter(r => isActive(r, now))
    .filter(r => matchesRegion(r, ctx))
    .filter(r => matchesCustomer(r, ctx))
    .filter(r => {
      const min = r.min_order ?? 0;
      const max = r.max_order ?? Infinity;
      return subtotal >= min && subtotal <= (max || Infinity);
    })
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  const taxes: AppliedTax[] = [];
  let totalTax = 0;
  let inclusiveTax = 0;

  for (const rule of eligible) {
    const applicableItems = taxableItemsFor(rule, ctx.items);
    const base = applicableItems.reduce((s, i) => s + i.price * i.quantity, 0);
    if (base <= 0 && rule.value_type === "percentage") continue;

    let amount = 0;
    if (rule.value_type === "fixed") {
      amount = rule.rate;
    } else if (rule.inclusive) {
      // Tax already contained in the price: extract it
      amount = base - base / (1 + rule.rate / 100);
    } else {
      amount = base * (rule.rate / 100);
    }
    amount = round2(amount);
    if (amount <= 0) continue;

    taxes.push({
      tax_id: rule.id,
      tax_name: rule.name,
      tax_type: rule.tax_type,
      value_type: rule.value_type,
      inclusive: rule.inclusive,
      rate: rule.rate,
      taxable_base: round2(base),
      tax_amount: amount,
      country: rule.country,
      state: rule.state,
      priority: rule.priority,
      timestamp,
    });

    if (rule.inclusive) inclusiveTax += amount;
    else totalTax += amount;
  }

  return {
    taxes,
    totalTax: round2(totalTax),
    inclusiveTax: round2(inclusiveTax),
    taxableSubtotal: round2(subtotal),
  };
}

// Server-side validation shared by API routes.
export function validateTaxRule(input: Record<string, unknown>): string | null {
  if (!input.name || String(input.name).trim() === "") return "Tax name is required";
  if (!input.country || String(input.country).trim() === "") return "Country is required";
  const rate = Number(input.rate);
  if (!Number.isFinite(rate)) return "Tax value must be a number";
  if (rate < 0) return "Tax value cannot be negative";
  if (input.value_type === "percentage" && rate > 100) return "Percentage cannot exceed 100%";
  if (input.start_date && input.end_date && new Date(input.start_date as string) > new Date(input.end_date as string)) {
    return "End date must be after the start date";
  }
  return null;
}
