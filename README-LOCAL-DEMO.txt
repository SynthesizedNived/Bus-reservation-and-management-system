KSRTC Swift Roleplay – localStorage prototype update

Files:
- index.html
- style.css
- app.js

Place all three files in the same website folder, replacing the previous files.
Keep your existing assets folder (including the KSRTC logo) alongside them.

Demo admin login:
admin@neo.demo
admin123

New local demo capabilities:
- Crew sign-in tab (no public crew registration)
- Admin-created Driver and Conductor accounts
- Admin assignment of crew to services
- Crew digital ID and assigned trip dashboard
- Conductor manifest sourced from confirmed booking records
- Boarding checkbox saved on the corresponding booking records
- Driver check-in, departure, arrival and completion actions
- Delay and incident / breakdown notes
- 40 passenger seats plus a non-bookable reserved conductor seat
- Simulated UPI, card and net-banking payment methods, including a failure test option
- Timetable hides services once their scheduled departure time has passed
- City autocomplete removed

Important limitations:
- This is a browser-local demonstration. Data is stored in localStorage on the current browser/device only.
- Crew/admin changes do not synchronise to other devices or browsers.
- Demo passwords are stored in browser-accessible data and are not secure authentication.
- Email confirmation cannot be securely sent from a static localStorage-only site. It requires a backend or trusted transactional-email service.
- Payments are simulations only. No real payment gateway, card details or money transfers are used.
- Data can be cleared by the browser or lost when local storage is cleared. Export/backup your demo data before resetting the browser.
