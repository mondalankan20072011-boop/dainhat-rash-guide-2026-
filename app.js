
/* DAINHAT RASH GUIDE 2026
   Google Maps Direction Added
   Browser-local storage only.
*/
(() => {
  "use strict";

  const STORAGE_KEY = "dainhat-rash-guide-places-v1";
  const DEMO_ADMIN_PASSWORD = "ANKAN555666";

  const initialPlaces = [
    {id:"seed-1",name:"সাহাপাড়া নাগরিক মঞ্চ",note:"সঠিক GPS পিন Admin-কে ম্যাপে বসাতে হবে।",lat:null,lng:null,verified:false},
    {id:"seed-2",name:"ছোটঠাকুরুন তলা",note:"সঠিক GPS পিন Admin-কে ম্যাপে বসাতে হবে।",lat:null,lng:null,verified:false},
    {id:"seed-3",name:"নটরাজ",note:"সঠিক GPS পিন Admin-কে ম্যাপে বসাতে হবে।",lat:null,lng:null,verified:false},
    {id:"seed-4",name:"ব্যাংকের পাশে",note:"ব্যাংকের নির্দিষ্ট নাম ও সঠিক GPS পিন যাচাই করা বাকি।",lat:null,lng:null,verified:false}
  ];

  const $ = id => document.getElementById(id);

  let places = loadPlaces();
  let isAdmin = false;
  let pendingPoint = null;
  let markers = new Map();
  let selectedCategory = "all";

  function loadPlaces() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn("Could not read saved places", err);
    }

    return initialPlaces.map(p => ({...p}));
  }

  function savePlaces() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
      return true;
    } catch (err) {
      alert("এই ব্রাউজারে লোকেশন সেভ করা যায়নি। Storage permission বা জায়গা পরীক্ষা করুন।");
      console.error(err);
      return false;
    }
  }

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[ch]));

  const hasPoint = p =>
    Number.isFinite(Number(p.lat)) &&
    Number.isFinite(Number(p.lng)) &&
    p.lat !== null &&
    p.lng !== null;

  // MAP
  const map = L.map("map", {zoomControl:true})
    .setView([23.0, 88.0], 8);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
  }).addTo(map);

  function markerIcon() {
    return L.divIcon({
      className:"custom-pin",
      html:'<span style="display:block;width:16px;height:16px;border:3px solid #d1fae5;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#10b981;box-shadow:0 2px 12px #0008"></span>',
      iconSize:[18,18],
      iconAnchor:[9,18]
    });
  }

  // DRAW MAP MARKERS
  function drawMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers.clear();

    places.filter(hasPoint).forEach(place => {
      const marker = L.marker(
        [Number(place.lat),Number(place.lng)],
        {icon:markerIcon()}
      ).addTo(map);

      const adminButtons = isAdmin
        ? `<div class="popup-actions">
             <button type="button"
             onclick="window.DainhatApp.edit('${esc(place.id)}')">
             Edit</button>
           </div>`
        : "";

      marker.bindPopup(`
        <strong>${esc(place.name)}</strong><br>
        ${esc(place.note || "বিবরণ নেই")}<br>
        <small>${place.verified ? "যাচাইকৃত স্থানাঙ্ক" : "স্থানাঙ্ক যাচাই বাকি"}</small>
        ${adminButtons}
      `);

      marker.on("click", () => {
        if (isAdmin) selectPlace(place.id);
      });

      markers.set(place.id, marker);
    });

    renderPlaces();
  }

  // PLACES LIST + GOOGLE MAPS DIRECTION
  function renderPlaces() {
    const query = $("searchInput").value
      .trim()
      .toLocaleLowerCase();

    const filtered = places.filter(p =>
      `${p.name} ${p.note || ""}`
        .toLocaleLowerCase()
        .includes(query)
    );

    $("placeCount").textContent = `${places.length} লোকেশন`;

    $("placesList").innerHTML = filtered.length
      ? filtered.map(p => {
          const canNavigate = hasPoint(p);

          const destination = canNavigate
            ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                `${Number(p.lat)},${Number(p.lng)}`
              )}&travelmode=walking`
            : "";

          return `
            <article class="place-card">

              <div class="place-icon">⌖</div>

              <div class="place-info">
                <strong>${esc(p.name)}</strong>
                <p>
                  ${
                    canNavigate
                      ? (p.verified ? "GPS পিন যাচাইকৃত" : "GPS পিন যাচাই বাকি")
                      : "ম্যাপে পিন বসানো হয়নি"
                  }
                </p>
              </div>

              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">

                <button
                  class="button button-outline"
                  type="button"
                  data-show="${esc(p.id)}">
                  Map-এ দেখুন
                </button>

                ${
                  canNavigate
                    ? `<a
                        class="button button-outline"
                        href="${destination}"
                        target="_blank"
                        rel="noopener noreferrer">
                        Get Direction
                      </a>`
                    : `<button
                        class="button button-outline"
                        type="button"
                        disabled>
                        Get Direction
                      </button>`
                }

              </div>

            </article>
          `;
        }).join("")
      : '<p class="muted small">কোনো লোকেশন পাওয়া যায়নি।</p>';

    $("placesList")
      .querySelectorAll("[data-show]")
      .forEach(btn => {
        btn.addEventListener("click", () => {
          const p = places.find(
            item => item.id === btn.dataset.show
          );

          if (!p) return;

          if (hasPoint(p)) {
            map.setView(
              [Number(p.lat),Number(p.lng)],
              17
            );
            markers.get(p.id)?.openPopup();
          } else if (isAdmin) {
            selectPlace(p.id);
          } else {
            alert("এই লোকেশনের সঠিক GPS পিন এখনো Admin যোগ করেননি।");
          }
        });
      });
  }

  // SELECT PLACE
  function selectPlace(id) {
    const p = places.find(item => item.id === id);
    if (!p || !isAdmin) return;

    $("placeId").value = p.id;
    $("placeName").value = p.name;
    $("placeNote").value = p.note || "";
    $("deletePlaceBtn").disabled = false;

    $("adminHint").textContent = hasPoint(p)
      ? `নির্বাচিত পিন: ${p.lat}, ${p.lng}`
      : "এই লোকেশনের GPS পিন নেই। ম্যাপে ক্লিক করে পিন বসান।";

    pendingPoint = hasPoint(p)
      ? {lat:Number(p.lat),lng:Number(p.lng)}
      : null;
  }

  // RESET FORM
  function resetForm() {
    $("placeForm").reset();
    $("placeId").value = "";
    $("deletePlaceBtn").disabled = true;
    pendingPoint = null;

    $("adminHint").textContent =
      "ম্যাপে ক্লিক করে নতুন পিনের জায়গা নির্বাচন করুন, অথবা তালিকা থেকে কোনো লোকেশন বেছে নিন।";
  }

  // ADMIN UI
  function updateAdminUI() {
    $("adminPanel").classList.toggle("hidden",!isAdmin);
    $("adminToggle").textContent = isAdmin
      ? "Admin Mode ON"
      : "Admin Login";

    $("mapMode").textContent = isAdmin
      ? "ADMIN EDIT MODE"
      : "VIEW MODE";

    $("adminHint").textContent = isAdmin
      ? "ম্যাপে ক্লিক করলে নতুন লোকেশনের স্থানাঙ্ক ফর্মে আসবে।"
      : "";

    drawMarkers();
  }

  // MAP CLICK TO ADD PIN
  map.on("click", event => {
    if (!isAdmin) return;

    pendingPoint = {
      lat:Number(event.latlng.lat.toFixed(6)),
      lng:Number(event.latlng.lng.toFixed(6))
    };

    if (!$("placeId").value) {
      $("placeId").value = "";
      $("placeName").focus();
    }

    $("adminHint").textContent =
      `নির্বাচিত পিন: ${pendingPoint.lat}, ${pendingPoint.lng} — নাম লিখে Save Location চাপুন।`;
  });

  // SAVE LOCATION
  $("placeForm").addEventListener("submit", event => {
    event.preventDefault();

    if (!isAdmin) {
      return alert("শুধুমাত্র Admin লোকেশন পরিবর্তন করতে পারবেন।");
    }

    const id = $("placeId").value;
    const name = $("placeName").value.trim();
    const note = $("placeNote").value.trim();

    if (!name) return;

    if (id) {
      const p = places.find(item => item.id === id);
      if (!p) return;

      p.name = name;
      p.note = note;

      if (pendingPoint) {
        p.lat = pendingPoint.lat;
        p.lng = pendingPoint.lng;
        p.verified = true;
      }
    } else {
      if (!pendingPoint) {
        return alert("প্রথমে ম্যাপে ক্লিক করে নতুন পিনের জায়গা নির্বাচন করুন।");
      }

      places.push({
        id:crypto.randomUUID
          ? crypto.randomUUID()
          : `place-${Date.now()}`,
        name,
        note,
        lat:pendingPoint.lat,
        lng:pendingPoint.lng,
        verified:true
      });
    }

    if (savePlaces()) {
      drawMarkers();
      resetForm();
    }
  });

  // NEW PLACE
  $("newPlaceBtn").addEventListener("click",resetForm);

  // DELETE PLACE
  $("deletePlaceBtn").addEventListener("click",() => {
    if (!isAdmin) return;

    const id = $("placeId").value;
    const p = places.find(item => item.id === id);

    if (!p || !confirm(`“${p.name}” মুছে ফেলবেন?`)) return;

    places = places.filter(item => item.id !== id);

    if (savePlaces()) {
      drawMarkers();
      resetForm();
    }
  });

  // ADMIN LOGIN
  $("adminToggle").addEventListener("click",() => {
    if (isAdmin) {
      isAdmin = false;
      updateAdminUI();
      return;
    }

    $("loginError").textContent = "";
    $("loginDialog").showModal();
    $("adminPassword").focus();
  });

  $("loginForm").addEventListener("submit",event => {
    event.preventDefault();

    if ($("adminPassword").value === DEMO_ADMIN_PASSWORD) {
      isAdmin = true;
      $("loginDialog").close();
      $("adminPassword").value = "";
      updateAdminUI();
    } else {
      $("loginError").textContent =
        "পাসওয়ার্ড মেলেনি। নিজের সেট করা পাসওয়ার্ড পরীক্ষা করুন।";
    }
  });

  $("cancelLogin").addEventListener(
    "click",
    () => $("loginDialog").close()
  );

  $("logoutBtn").addEventListener("click",() => {
    isAdmin = false;
    resetForm();
    updateAdminUI();
  });

  // SEARCH
  $("searchInput").addEventListener("input",renderPlaces);

  // MY LOCATION
  $("locateBtn").addEventListener("click",() => {
    if (!navigator.geolocation) {
      return alert("এই ব্রাউজারে GPS সমর্থিত নয়।");
    }

    $("locateBtn").disabled = true;
    $("locateBtn").textContent = "অবস্থান খোঁজা হচ্ছে…";

    navigator.geolocation.getCurrentPosition(
      pos => {
        const point = [
          pos.coords.latitude,
          pos.coords.longitude
        ];

        map.setView(point,17);

        L.circleMarker(point,{
          radius:8,
          color:"#d1fae5",
          weight:3,
          fillColor:"#10b981",
          fillOpacity:.9
        })
        .addTo(map)
        .bindPopup("আপনার বর্তমান অবস্থান")
        .openPopup();

        $("locateBtn").disabled = false;
        $("locateBtn").textContent = "◎ আমার অবস্থান";
      },

      err => {
        alert(
          err.code === 1
            ? "GPS permission দেওয়া হয়নি। Browser settings থেকে Location permission চালু করুন।"
            : "বর্তমান অবস্থান পাওয়া যায়নি। GPS চালু আছে কি না দেখুন।"
        );

        $("locateBtn").disabled = false;
        $("locateBtn").textContent = "◎ আমার অবস্থান";
      },

      {
        enableHighAccuracy:true,
        timeout:12000,
        maximumAge:10000
      }
    );
  });

  // GLOBAL ADMIN EDIT
  window.DainhatApp = {
    edit:selectPlace
  };

  drawMarkers();
  updateAdminUI();

  setTimeout(() => map.invalidateSize(),250);

})();
     
