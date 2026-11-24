# Vitron Electronics — Smart life

Online electronics shop for Kenya. Customers order without paying online and pay on
delivery, and the order details go to the store on WhatsApp.

```
vitron/
├── frontend/        React + TanStack Router + Tailwind v4 (static site)
├── backend/         Bun API + PostgreSQL (no runtime dependencies)
├── .do/app.yaml     DigitalOcean App Platform spec
└── docker-compose.yml   local PostgreSQL
```

## Run it locally

You need **Bun** (`curl -fsSL https://bun.sh/install | bash`) and **PostgreSQL 14+**.

### 1. Start PostgreSQL

With Docker:
```bash
docker compose up -d
```
Without Docker (Ubuntu):
```bash
sudo apt install postgresql
sudo -u postgres psql -c "CREATE USER vitron WITH PASSWORD 'vitron';"
sudo -u postgres psql -c "CREATE DATABASE vitron OWNER vitron;"
```

### 2. Backend (terminal 1)
```bash
cd backend
cp .env.example .env              # defaults work with the database above
bun run seed                      # creates tables + sample categories/products
bun run create-admin 0712345678 'your-strong-password' "Your Name"
bun run dev                       # http://localhost:4000/api/health
```

### 3. Frontend (terminal 2)
```bash
cd frontend
bun install
bun dev                           # http://localhost:3000
```

- **Store:** http://localhost:3000
- **Admin panel:** http://localhost:3000/admin. Sign in with the phone and password from `create-admin`.
- **Before going live,** set your real WhatsApp number in **Admin → Settings**.

### Tests
With the backend running and the test admin created
(`bun run create-admin 0711111111 'admin-pass-1' "Test Admin"`):
```bash
cd backend && bun test
```
The 30 end-to-end tests cover checkout, price tampering, stock, tracking, accounts,
every role permission and the order lifecycle. Don't run them against your live database.

## How ordering works

1. The customer adds items to the cart. The cart lives in the browser; no account is needed.
2. At checkout they enter name, phone, delivery area, town and address. They can tick
   **Create an account** to track orders later.
3. The server re-prices every item from the database, reserves stock in one transaction
   (it can never oversell), adds the delivery fee for the area, and saves the order as
   **pending / cash on delivery**.
4. The success page opens WhatsApp with the full order pre-filled, addressed to the store number.
5. Staff confirm the order by phone, then mark it **confirmed → dispatched → delivered**,
   then **paid**. Cancelling puts the stock back.
6. Customers track orders at `/track` with their order number and phone, or under **My account**.

## Roles

| | Customer | Staff | Admin |
|---|:-:|:-:|:-:|
| Shop, order, track own orders | ✓ | ✓ | ✓ |
| Dashboard, orders (update status, mark paid) | | ✓ | ✓ |
| Customers list, stock levels | | ✓ | ✓ |
| View products, categories, settings | | ✓ | ✓ |
| Create/edit/delete products & categories, upload images | | | ✓ |
| Change store settings (WhatsApp number, delivery fees…) | | | ✓ |
| Add staff, change roles, disable accounts, reset passwords | | | ✓ |

The server checks permissions on every request and re-reads the user's role each time,
so a role change or a disabled account takes effect immediately. An admin can't demote or
disable themselves, and the last admin can't be removed.

## Deploy to DigitalOcean

1. Push this folder to a GitHub repo.
2. In `.do/app.yaml`, replace `YOUR_GITHUB_USER/vitron` with your repo.
3. Create the app: `doctl apps create --spec .do/app.yaml`. You can also go to
   **Apps → Create App → GitHub** in the DigitalOcean dashboard and upload the spec.
4. In the app's **Settings → api → Environment Variables**, set `JWT_SECRET` to a long
   random value (`openssl rand -hex 32`). The API refuses to start without one of 32+ characters.
5. **Product images:** create a Spaces bucket and an access key, then fill in the `SPACES_*`
   variables. Without Spaces, uploaded images are lost on every redeploy.
6. **First admin:** open the **api** component's **Console** tab and run:
   `bun scripts/create-admin.js 0712345678 'strong-password' "Your Name"`.
   Optionally run `bun scripts/seed.js` for the sample catalogue.
7. Add your domain under **Settings → Domains**.

Database migrations run automatically every time the API starts.

**Why it shouldn't hang:**
- A health check on `/api/health` makes App Platform restart the API if it stops answering.
- Every request has a 15-second limit, and browser calls time out after 20 seconds with a clear message.
- Deploys have zero downtime, and the server shuts down gracefully, finishing requests before exiting.
- The frontend is a static site on DigitalOcean's CDN.

**Database:** the spec starts with a dev database. Before real traffic, create a
**Managed PostgreSQL** cluster, which has daily backups and standby nodes, and attach it as `db`.

## API overview

Public: `GET /api/health`, `/api/settings`, `/api/categories`, `/api/brands`, `/api/products`,
`/api/products/:slug`, `POST /api/orders`, `GET /api/orders/track?number=&phone=`

Account: `POST /api/auth/register`, `/api/auth/login`, `GET /api/auth/me`, `PATCH /api/me`,
`POST /api/me/password`, `GET /api/me/orders`, `/api/me/orders/:number`

Admin: `/api/admin/stats`, `/products`, `/products/:id/stock`, `/categories`, `/uploads`,
`/orders`, `/orders/:id`, `/customers`, `/users`, `/settings`
