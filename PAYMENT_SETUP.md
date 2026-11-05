# Payment integration setup

The frontend now contains a Razorpay Checkout integration scaffold. It deliberately does **not** mark a booking as paid unless the backend confirms that the payment signature has been verified.

The supplied project did not include a backend, database, Razorpay credentials, or server-side booking API. Therefore real payments cannot be completed until the server endpoints below are implemented and deployed.

## 1. Configure the backend URL

At the top of `app.js`, the frontend reads:

```js
const PAYMENT_API_BASE = window.PAYMENT_API_BASE || '';
```

If the payment API is hosted on a separate domain, define the URL before `app.js` loads in `index.html`:

```html
<script>
  window.PAYMENT_API_BASE = 'https://your-api-domain.example';
</script>
<script src="app.js"></script>
```

If the frontend and API are served from the same origin, leave the value empty.

## 2. Required server endpoints

### `POST /api/payments/create-order`

The frontend sends:

```json
{
  "serviceId": 1,
  "seats": ["1", "2"],
  "passengers": [
    {
      "seat": "1",
      "passenger": "Passenger name",
      "age": "25",
      "phone": "9999999999",
      "email": "passenger@example.com",
      "boarding": "Main Bus Stand",
      "drop": "Destination"
    }
  ],
  "journeyDate": "YYYY-MM-DD",
  "expectedAmount": 1000,
  "currency": "INR"
}
```

The backend must **not trust `expectedAmount`**. It must load the service and fare from its own database, recalculate the total, validate that the seats are still available, create a pending booking/seat hold, and create the Razorpay order using the server-side Razorpay key secret.

Return:

```json
{
  "keyId": "rzp_live_or_test_public_key_id",
  "orderId": "order_xxxxxxxxxxxxxx",
  "amount": 100000,
  "currency": "INR"
}
```

`amount` must be the amount in paise. `keyId` is the public key ID; never return the Razorpay key secret.

### `POST /api/payments/verify`

The frontend sends:

```json
{
  "orderId": "order_xxxxxxxxxxxxxx",
  "paymentId": "pay_xxxxxxxxxxxxxx",
  "signature": "razorpay_checkout_signature"
}
```

The backend must:

1. Find the pending order and booking using the authenticated user/session.
2. Verify the Razorpay signature on the server using the Razorpay key secret and HMAC-SHA256.
3. Confirm the payment belongs to the expected order and amount, and check its actual payment status.
4. Make the operation idempotent so retries cannot create duplicate bookings or charge/confirm the same booking twice.
5. Atomically mark the booking as paid/confirmed and reserve the seats only after verification.
6. Return a booking reference only after successful verification.

Successful response:

```json
{
  "verified": true,
  "bookingRef": "BUS-2026-000123"
}
```

For every unverified, failed, cancelled, expired, or mismatched payment, return a non-success HTTP status and do not confirm the booking.

## 3. Production requirements

- Store `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in server environment variables.
- Never put the key secret in `app.js`, HTML, GitHub, or browser storage.
- Use HTTPS for the frontend and backend.
- Configure CORS and CSRF protection appropriately.
- Authenticate the customer and authorize every booking/payment request.
- Validate prices, service IDs, dates, seat availability, and passenger data on the server.
- Use database transactions/unique constraints to prevent two customers booking the same seat.
- Add Razorpay webhooks as a reconciliation mechanism for delayed or asynchronous payment updates.
- Do not rely only on the browser callback as proof of payment.

## 4. Current project limitation

The existing application stores users, services, bookings, and crew data in browser `localStorage`. That storage is local to one browser and is not a shared database. The new frontend keeps a local booking display record after the server returns a verified booking reference, but a real multi-user deployment must also move authentication, service data, booking records, seat inventory, crew assignments, and admin reporting to the backend.

The current seeded administrator account is only a local development convenience. Replace it with server-managed administrator authentication before public deployment.

## 5. Payment logo placeholders

The checkout currently uses editable text-based placeholders for UPI, Visa, RuPay, Net banking, and Wallets. Replace the contents of `.payment-logo-placeholder` in `index.html` with official, approved logo image assets when you have them. Do not use a payment provider's logo in a way that implies a payment method is active until the provider is configured.
