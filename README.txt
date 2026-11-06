SIMULATED PAYMENT UPDATE

Files included:
- index.html
- app.js
- style.css

How to install:
1. Make a backup of your existing three files.
2. Replace index.html, app.js and style.css in your project folder with these versions.
3. Keep your existing assets/ folder and all images; this update does not replace those.
4. Commit and push the three updated files to GitHub.
5. Open the website and hard-refresh it (Ctrl+F5 on desktop). On mobile, clear the site's cached files or open a private tab for a clean test.

How the simulated checkout works:
- Select UPI, Visa, RuPay, Net banking or Wallet. The selected method gets highlighted.
- Tap Continue to payment to simulate a successful payment.
- Tap Simulate failed payment to test the failure and retry path.
- A successful simulation creates a booking and transaction reference in this browser's Local Storage.
- A failed simulation creates no booking and does not reserve the seats.

IMPORTANT:
This is a front-end demonstration only. It does not contact a bank, Razorpay, UPI app or card network. No money is collected. Local Storage is not a secure shared booking database and does not synchronize bookings between visitors/devices.
