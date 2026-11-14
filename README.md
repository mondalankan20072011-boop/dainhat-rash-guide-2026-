# DAINHAT RASH GUIDE 2026

দাঁইহাট-কেন্দ্রিক একটি mobile-friendly web app starter। UI-তে dark green / emerald glass effect, OpenStreetMap, search, GPS এবং Admin-only editing-এর প্রাথমিক ধারণা আছে।

## ফাইল
- `index.html` — app layout এবং map library
- `style.css` — responsive green glass UI
- `app.js` — map, search, GPS, local location storage এবং demo admin editing
- `README.md` — setup ও সীমাবদ্ধতা

## চালানোর নিয়ম
1. চারটি ফাইল একই folder-এ রাখুন।
2. Internet connection চালু রাখুন (Leaflet, OpenStreetMap tiles এবং Google Fonts CDN থেকে আসে)।
3. `index.html` browser-এ খুলুন। GPS-এর জন্য সাধারণত HTTPS বা localhost প্রয়োজন; GitHub Pages-এর HTTPS-এ চালালে ভালো।
4. GitHub-এ repository খুলে **Add file → Upload files** থেকে চারটি ফাইল upload করুন এবং Commit করুন।
5. GitHub Pages চালু করতে repository Settings → Pages → Deploy from a branch → `main` এবং `/ (root)` নির্বাচন করুন।

## Admin demo
- Admin Login password: `change-this-demo-password`
- ব্যবহারের আগে `app.js`-এ `DEMO_ADMIN_PASSWORD` বদলান।
- Admin Mode ON হলে ম্যাপে ক্লিক করে নতুন পিনের স্থানাঙ্ক বাছুন, তারপর নাম ও বিবরণ লিখে Save Location চাপুন।
- তালিকার লোকেশন বেছে নিয়ে Edit করা যায়। নির্বাচিত লোকেশনের পিন সরাতে Admin Mode-এ ম্যাপে নতুন জায়গায় ক্লিক করে Save চাপুন।
- Delete দিয়ে লোকেশন মুছুন।
- যত খুশি লোকেশন যোগ করা যায়; এই Starter-এ ব্রাউজারের `localStorage`-এ সংরক্ষিত হয়।

## গুরুত্বপূর্ণ সীমাবদ্ধতা — প্রকাশের আগে অবশ্যই কাজ বাকি
1. **এটি production-secure admin system নয়।** ডেমো পাসওয়ার্ড JavaScript ফাইলে দেখা যায়; যে কেউ source code দেখে নিতে পারে। বাস্তব অ্যাপে Firebase/Supabase বা নিজস্ব backend, secure authentication, role-based authorization এবং server-side permission checks লাগবে।
2. **এখনও cloud sync নেই।** লোকেশন শুধু একই browser/device-এর localStorage-এ থাকে। অন্য ফোনে বা অন্য ব্যবহারকারীর কাছে নিজে থেকে আপডেট যাবে না।
3. **চারটি লোকেশনের GPS coordinates ইচ্ছা করে বসানো হয়নি।** সঠিক অবস্থান যাচাই না করে কোনো latitude/longitude বানানো হয়নি। Admin-কে নির্ভুল জায়গায় ম্যাপে ক্লিক করে প্রতিটি পিন বসাতে হবে।
4. **Map start view একটি broad West Bengal view**, দাঁইহাটের guessed coordinates নয়। যাচাইকৃত Dainhat town-centre coordinates পাওয়া গেলে `app.js`-এর `setView([23.0, 88.0], 8)`-এ বসিয়ে zoom level বাড়াতে হবে।
5. **Dainhat-only scope UI-তে নির্ধারিত**, কিন্তু এই starter-এ geofence নেই। Admin ভুল করে দাঁইহাটের বাইরে pin বসাতে পারে। Production-এ যাচাইকৃত municipal boundary/geofence যুক্ত করতে হবে।
6. **Turn-by-turn navigation নেই।** OSM map tiles ও GPS আছে; পূর্ণ route calculation, voice guidance এবং navigation-এর জন্য routing service/API সংযুক্ত করতে হবে।
7. OSM tiles ব্যবহারে OpenStreetMap tile usage policy মানতে হবে; বেশি traffic হলে উপযুক্ত tile provider ব্যবহার করতে হবে।

## লোকেশন তালিকা
- সাহাপাড়া নাগরিক মঞ্চ
- ছোটঠাকুরুন তলা
- নটরাজ
- ব্যাংকের পাশে

শেষের “ব্যাংকের পাশে” লোকেশনের জন্য নির্দিষ্ট ব্যাংকের নামও পরে নিশ্চিত করলে ভালো হয়।

## নিরাপত্তা সতর্কতা
ডেমো পাসওয়ার্ড দিয়ে public website-এ বাস্তব admin data রক্ষা করা যাবে না। Production backend না হওয়া পর্যন্ত public hosting-এ Admin Login-কে নিরাপদ authentication হিসেবে ব্যবহার করবেন না।
