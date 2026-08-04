// @ts-nocheck
// Single source of truth for the Enterprise Settings Center. Each field's value
// is stored in system_settings under `group.key`; the registry defines type,
// default, label and options so the UI and API stay in sync. Secrets are never
// stored here — those live in server env vars (see Integrations / Security).
export const REGISTRY = {
  general: [
    ["store_name", "Store Name", "text", "Atlanta Sneakers"],
    ["store_description", "Store Description", "textarea", "Premium authentic sneakers."],
    ["logo_url", "Store Logo (URL)", "text", ""],
    ["favicon_url", "Favicon (URL)", "text", ""],
    ["business_address", "Business Address", "text", ""],
    ["support_email", "Support Email", "text", "support@atlantasneaker.com"],
    ["support_phone", "Support Phone", "text", ""],
    ["country", "Country", "text", "Haiti"],
    ["city", "City", "text", "Port-au-Prince"],
    ["timezone", "Timezone", "select", "America/Port-au-Prince", ["UTC", "America/Port-au-Prince", "America/New_York", "Europe/Paris"]],
    ["currency", "Currency", "select", "USD", ["USD", "HTG", "EUR", "CAD"]],
    ["language", "Language", "select", "en", ["en", "fr", "ht", "es"]],
    ["date_format", "Date Format", "select", "MM/DD/YYYY", ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]],
    ["time_format", "Time Format", "select", "12h", ["12h", "24h"]],
    ["weight_units", "Weight Units", "select", "kg", ["kg", "lb"]],
    ["length_units", "Length Units", "select", "cm", ["cm", "in"]],
  ],
  localization: [
    ["default_country", "Default Country", "text", "Haiti"],
    ["countries", "Enabled Countries (comma)", "text", "Haiti"],
    ["languages", "Enabled Languages (comma)", "text", "en,fr"],
    ["currencies", "Enabled Currencies (comma)", "text", "USD,HTG"],
    ["exchange_rate_htg", "USD→HTG Exchange Rate", "number", 132],
  ],
  store: [
    ["store_mode", "Store Mode", "select", "production", ["production", "maintenance", "coming_soon"]],
    ["announcement", "Announcement Bar Text", "text", ""],
  ],
  checkout: [
    ["min_order", "Minimum Order ($)", "number", 0],
    ["max_order", "Maximum Order ($, 0=off)", "number", 0],
    ["guest_checkout", "Guest Checkout", "toggle", true],
    ["terms_required", "Require Terms Acceptance", "toggle", true],
    ["auto_invoice", "Auto-generate Invoice", "toggle", true],
    ["auto_confirm", "Auto-confirm Paid Orders", "toggle", false],
    ["order_prefix", "Order Number Prefix", "text", "ATL"],
    ["invoice_prefix", "Invoice Prefix", "text", "INV"],
  ],
  product: [
    ["auto_sku", "Auto-generate SKU", "toggle", true],
    ["sku_prefix", "SKU Prefix", "text", "ATL"],
    ["auto_barcode", "Auto-generate Barcode", "toggle", false],
    ["default_warranty", "Default Warranty (days)", "number", 0],
    ["default_tax", "Default Tax (%)", "number", 0],
    ["default_shipping", "Default Shipping ($)", "number", 0],
    ["low_stock_alert", "Low Stock Alert (qty)", "number", 5],
    ["stock_reservation", "Reserve Stock at Checkout", "toggle", true],
    ["default_visibility", "Default Visibility", "select", "active", ["active", "draft", "hidden"]],
  ],
  order: [
    ["auto_cancel", "Auto-cancel Unpaid", "toggle", false],
    ["pending_timeout", "Pending Timeout (minutes)", "number", 1440],
    ["return_period", "Return Period (days)", "number", 30],
    ["refund_policy", "Refund Policy", "select", "manual", ["manual", "auto", "none"]],
  ],
  customer: [
    ["registration", "Allow Registration", "toggle", true],
    ["email_verification", "Require Email Verification", "toggle", true],
    ["phone_verification", "Require Phone Verification", "toggle", false],
    ["two_factor", "Offer 2FA", "toggle", false],
    ["customer_groups", "Customer Groups (comma)", "text", "Standard,VIP,Wholesale"],
  ],
  seller: [
    ["seller_registration", "Allow Seller Registration", "toggle", false],
    ["seller_verification", "Require Seller Verification", "toggle", true],
    ["commission", "Commission (%)", "number", 10],
    ["min_withdraw", "Minimum Withdraw ($)", "number", 50],
    ["seller_levels", "Seller Levels (comma)", "text", "Bronze,Silver,Gold"],
  ],
  payment_defaults: [
    ["default_gateway", "Default Gateway", "select", "moncash", ["moncash", "natcash", "stripe", "paypal"]],
    ["default_currency", "Default Currency", "select", "USD", ["USD", "HTG"]],
    ["payment_timeout", "Payment Timeout (minutes)", "number", 30],
    ["capture_mode", "Capture Mode", "select", "auto", ["auto", "manual"]],
  ],
  shipping_defaults: [
    ["default_zone", "Default Shipping Zone", "text", "Haiti"],
    ["free_shipping_threshold", "Free Shipping Over ($)", "number", 100],
    ["standard_rate", "Standard Rate ($)", "number", 9.99],
    ["express_rate", "Express Rate ($)", "number", 19.99],
    ["default_weight", "Default Weight (kg)", "number", 1],
  ],
  email: [
    ["sender_name", "Sender Name", "text", "Atlanta Sneakers"],
    ["sender_email", "Sender Email", "text", "noreply@atlantasneaker.com"],
    ["reply_to", "Reply-To", "text", "support@atlantasneaker.com"],
    ["footer_text", "Email Footer", "text", "© Atlanta Sneakers"],
  ],
  seo_defaults: [
    ["meta_title", "Default Meta Title", "text", "Atlanta Sneakers"],
    ["meta_description", "Default Meta Description", "textarea", "Shop authentic sneakers."],
    ["robots", "Robots", "select", "index,follow", ["index,follow", "noindex,nofollow", "index,nofollow"]],
    ["og_enabled", "Open Graph", "toggle", true],
    ["twitter_card", "Twitter Card", "select", "summary_large_image", ["summary", "summary_large_image"]],
  ],
  security: [
    ["session_timeout", "Session Timeout (minutes)", "number", 720],
    ["max_login_attempts", "Max Login Attempts", "number", 5],
    ["captcha", "Enable CAPTCHA", "toggle", false],
    ["min_password_length", "Min Password Length", "number", 8],
    ["blocked_countries", "Blocked Countries (comma)", "text", ""],
  ],
  performance: [
    ["cache_enabled", "Enable Cache", "toggle", true],
    ["cache_ttl", "Cache TTL (seconds)", "number", 3600],
    ["cdn_enabled", "Enable CDN", "toggle", false],
    ["compression", "Compression", "toggle", true],
    ["lazy_loading", "Lazy Loading", "toggle", true],
    ["image_optimization", "Image Optimization", "toggle", true],
  ],
  media: [
    ["max_upload_mb", "Max Upload Size (MB)", "number", 10],
    ["allowed_types", "Allowed File Types (comma)", "text", "jpg,jpeg,png,webp,gif,mp4,pdf"],
    ["image_quality", "Image Quality (%)", "number", 82],
    ["thumbnail_generation", "Generate Thumbnails", "toggle", true],
  ],
  notifications: [
    ["email_enabled", "Email Notifications", "toggle", true],
    ["sms_enabled", "SMS Notifications", "toggle", false],
    ["push_enabled", "Push Notifications", "toggle", false],
    ["browser_enabled", "Browser Notifications", "toggle", false],
    ["slack_enabled", "Slack Notifications", "toggle", false],
    ["discord_enabled", "Discord Notifications", "toggle", false],
  ],
  system: [
    ["environment", "Environment", "select", "production", ["production", "development", "testing"]],
    ["debug", "Debug Mode", "toggle", false],
    ["maintenance", "Maintenance Mode", "toggle", false],
    ["version", "Platform Version", "text", "1.0.0"],
  ],
};

export function defaultFor(group, key) {
  const f = (REGISTRY[group] || []).find(x => x[0] === key);
  return f ? f[3] : null;
}
export function fieldMeta(group, key) {
  const f = (REGISTRY[group] || []).find(x => x[0] === key);
  return f ? { key: f[0], label: f[1], type: f[2], default: f[3], options: f[4] || null } : null;
}
