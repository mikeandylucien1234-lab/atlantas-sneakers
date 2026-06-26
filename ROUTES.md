# Atlanta Sneakers — Routes

## Public Pages

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Homepage — hero, featured products, brand carousel |
| `/shop` | `app/shop/page.tsx` | Shop all products with filters sidebar |
| `/product/[slug]` | `app/product/[slug]/page.tsx` | Product detail page |
| `/category/[slug]` | `app/category/[slug]/page.tsx` | Category listing page |
| `/best-sellers` | `app/best-sellers/page.tsx` | Top-selling products ranked 1–8 |
| `/new-arrivals` | `app/new-arrivals/page.tsx` | Latest product drops with time filters |
| `/deals` | `app/deals/page.tsx` | Flash deals with countdown timer and category filters |
| `/track` | `app/track/page.tsx` | Order tracking with timeline |

## Auth Pages

| Route | File | Description |
|---|---|---|
| `/auth/login` | `app/auth/login/page.tsx` | Sign in with email/password or Google |
| `/auth/register` | `app/auth/register/page.tsx` | Create account |
| `/auth/forgot-password` | `app/auth/forgot-password/page.tsx` | Password reset request |

## Protected Pages (require auth via proxy.ts)

| Route | File | Description |
|---|---|---|
| `/cart` | `app/cart/page.tsx` | Shopping cart with order summary |
| `/checkout` | `app/checkout/page.tsx` | 4-step checkout (shipping → payment → review → confirmation) |
| `/wishlist` | `app/wishlist/page.tsx` | Saved items with move-to-cart |
| `/account` | `app/account/page.tsx` | Profile, orders, addresses, rewards, settings |
