/* DAINHAT RASH GUIDE 2026
   Firebase + Leaflet
   Dainhat Only Map
   Satellite + Street Map Fallback
   Bengali + English Search
   Google Maps Directions
   GPS Red Pin + Liquid Glass Actions
*/

(() => {
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAKXzJopkZNG_0L2jrkb5vmXgrPEqMhERg",
    authDomain: "dainhat-rash-guide.firebaseapp.com",
    projectId: "dainhat-rash-guide",
    storageBucket: "dainhat-rash-guide.firebasestorage.app",
    messagingSenderId: "129291355113",
    appId: "1:129291355113:web:b35be037c2a5814d494178",
    measurementId: "G-E8RTZNCFPT"
  };

  const ADMIN_UID = "2FaORIg7uBcX3bd1AhLAvth8fEP2";
  const COLLECTION = "places";
  const VERSION = "10.14.1";

  const DAINHAT_CENTER = [23.6063, 88.1715];

  const DAINHAT_BOUNDS = L.latLngBounds(
    [23.5750, 88.1400],
    [23.6370, 88.2050]
  );

  const $ = id => document.getElementById(id);

  let db, auth, sdk, map, markerLayer;

  let places = [];
  let markers = new Map();
  let isAdmin = false;
  let selectedId = null;
  let pendingLocation = null;
  let pendingMarker = null;
  let activeCategory = "all";

  // Only one GPS marker
  let userLocationMarker = null;

  function status(message) {
    if ($("adminHint")) {
      $("adminHint").textContent = message;
    }
  }

  // APP THEME STYLES
  function injectAppStyles() {
    if ($("dainhat-extra-styles")) return;

    const style = document.createElement("style");
    style.id = "dainhat-extra-styles";

    style.textContent = `
      .place-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 7px;
      }

      .place-actions button,
      .place-actions a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
        padding: 7px 13px;
        border: 1px solid var(--line, rgba(167,243,208,.17));
        border-radius: 12px;
        background: rgba(10,55,42,.72);
        color: var(--mint, #a7f3d0);
        font: inherit;
        font-size: 12px;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        box-shadow: 0 5px 16px rgba(0,0,0,.16);
        transition: background .2s ease, border-color .2s ease,
                    transform .2s ease;
      }

      .place-actions button:hover,
      .place-actions a:hover {
        background: rgba(16,185,129,.20);
        border-color: var(--green, #10b981);
        transform: translateY(-1px);
      }

      .place-actions button:active,
      .place-actions a:active {
        transform: scale(.96);
      }

      .place-actions button:disabled {
        opacity: .5;
        cursor: not-allowed;
      }

      .user-location-div-icon {
        background: transparent !important;
        border: 0 !important;
      }

      .user-location-pin {
        position: relative;
        width: 26px;
        height: 26px;
        margin: 3px 0 0 2px;
        border: 3px solid #fff;
        border-radius: 50% 50% 50% 0;
        background: #ef3340;
        transform: rotate(-45deg);
        box-shadow: 0 3px 12px rgba(0,0,0,.5);
      }

      .user-location-pin span {
        position: absolute;
        width: 8px;
        height: 8px;
        top: 6px;
        left: 6px;
        border-radius: 50%;
        background: #fff;
      }
    `;

    document.head.appendChild(style);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[c]);
  }

  function coordinates(place) {
    const lat = Number(place.lat);
    const lng = Number(place.lng);

    if (
      place.lat == null ||
      place.lng == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) return null;

    return { lat, lng };
  }

  function directionURL(place) {
    const c = coordinates(place);

    const destination = c
      ? `${c.lat},${c.lng}`
      : place.name;

    return "https://www.google.com/maps/dir/?api=1&destination=" +
      encodeURIComponent(destination);
  }

  // FIREBASE INITIALIZATION
  async function initializeFirebase() {
    const [app, firestore, authentication] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-auth.js`)
    ]);

    const firebaseApp = app.initializeApp(FIREBASE_CONFIG);

    db = firestore.getFirestore(firebaseApp);
    auth = authentication.getAuth(firebaseApp);

    sdk = { ...firestore, ...authentication };
  }

  // MAP INITIALIZATION
  function initializeMap() {
    if (typeof L === "undefined" || !$("map")) {
      throw new Error("Leaflet পাওয়া যায়নি।");
    }

    map = L.map("map", {
      center: DAINHAT_CENTER,
      zoom: 15,
      minZoom: 13,
      maxZoom: 19,
      maxBounds: DAINHAT_BOUNDS,
      maxBoundsViscosity: 1,
      zoomControl: true,
      attributionControl: true
    });

    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles © Esri",
        maxZoom: 19,
        maxNativeZoom: 19,
        noWrap: true
      }
    );

    const streetMap = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
        maxNativeZoom: 19,
        noWrap: true
      }
    );

    satellite.addTo(map);

    let tileErrors = 0;
    let fallbackActivated = false;

    satellite.on("tileerror", () => {
      tileErrors++;

      if (tileErrors >= 3 && !fallbackActivated) {
        fallbackActivated = true;

        if (map.hasLayer(satellite)) {
          map.removeLayer(satellite);
        }

        streetMap.addTo(map);
        status("Satellite পাওয়া যাচ্ছে না। Street Map চালু হয়েছে।");
      }
    });

    L.control.layers({
      "Satellite View": satellite,
      "Street Map": streetMap
    }).addTo(map);

    map.fitBounds(DAINHAT_BOUNDS);

    markerLayer = L.layerGroup().addTo(map);

    map.on("click", event => {
      if (!isAdmin) return;

      if (!DAINHAT_BOUNDS.contains(event.latlng)) {
        status("শুধু দাঁইহাট এলাকার মধ্যে Pin বসানো যাবে।");
        return;
      }

      pendingLocation = {
        lat: event.latlng.lat,
        lng: event.latlng.lng
      };

      if (pendingMarker) {
        map.removeLayer(pendingMarker);
      }

      pendingMarker = L.marker(event.latlng)
        .addTo(map)
        .bindPopup("নতুন Location")
        .openPopup();

      status("Pin বসানো হয়েছে। এবার Save Location চাপো।");
    });

    map.attributionControl.setPrefix(false);
  }

  // SEARCH
  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}]+/gu, "");
  }

  const aliases = {
    "সাহাপাড়া নাগরিক মঞ্চ": [
      "sahapara nagarik mancha",
      "sahapara",
      "nagarik mancha"
    ],
    "ছোটঠাকুরুন তলা": [
      "chotothakurun tala",
      "choto thakurun tala"
    ],
    "নটরাজ": ["natraj", "nataraj"],
    "দাঁইহাট": ["dainhat", "dainhaat"]
  };

  function matchesSearch(place, search) {
    if (!search) return true;

    const query = normalize(search);

    const values = [
      place.name,
      place.note,
      place.category,
      ...(aliases[place.name] || [])
    ];

    return values.some(value =>
      normalize(value).includes(query)
    );
  }

  function categoryMatches(place) {
    if (activeCategory === "all") return true;

    const groups = {
      "রাস মণ্ডপ": ["রাস মণ্ডপ", "প্যান্ডেল"],
      "Railway Station": ["Railway Station", "রেলওয়ে স্টেশন"],
      "Bus Stand": ["Bus Stand", "বাস স্ট্যান্ড"],
      "Parking": ["Parking", "পার্কিং"],
      "Hospital": ["Hospital", "হাসপাতাল"],
      "Public Toilet": ["Public Toilet", "পাবলিক টয়লেট"]
    };

    return (groups[activeCategory] || [activeCategory])
      .includes(place.category);
  }

  function filteredPlaces() {
    const search = $("searchInput")?.value || "";

    return places.filter(place =>
      matchesSearch(place, search) &&
      categoryMatches(place)
    );
  }

  // MAP POPUP
  function createPopup(place) {
    const box = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = place.name;

    const note = document.createElement("p");
    note.textContent = place.note || "";

    const link = document.createElement("a");
    link.href = directionURL(place);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Direction দেখুন →";

    box.append(title);

    if (place.note) box.append(note);

    box.append(link);

    return box;
  }

  // RENDER MAP
  function renderMap() {
    if (!markerLayer) return;

    markerLayer.clearLayers();
    markers.clear();

    places.forEach(place => {
      const c = coordinates(place);

      if (!c) return;

      const point = L.latLng(c.lat, c.lng);

      if (!DAINHAT_BOUNDS.contains(point)) return;

      const marker = L.marker(point);

      marker.bindPopup(createPopup(place));
      marker.addTo(markerLayer);

      markers.set(place.id, marker);
    });
  }

  // RENDER LOCATION LIST
  function renderList(list) {
    const container = $("placesList");

    if (!container) return;

    if (!list.length) {
      container.innerHTML =
        '<div class="empty-message">কোনো লোকেশন পাওয়া যায়নি।</div>';

      return;
    }

    container.innerHTML = list.map(place => `
      <div class="place-card">
        <div class="place-icon">📍</div>

        <div class="place-info">
          <strong>${escapeHTML(place.name)}</strong>
          <p>${escapeHTML(place.note || "")}</p>
          <small>${escapeHTML(place.category || "অন্যান্য")}</small>
        </div>

        <div class="place-actions">
          <button type="button"
            class="view-place-btn"
            data-id="${escapeHTML(place.id)}">
            Map
          </button>

          <a class="direction-btn"
            href="${escapeHTML(directionURL(place))}"
            target="_blank"
            rel="noopener noreferrer">
            Direction
          </a>

          ${isAdmin ? `
            <button type="button"
              class="edit-place-btn"
              data-id="${escapeHTML(place.id)}">
              Edit
            </button>
          ` : ""}
        </div>
      </div>
    `).join("");
  }

  function renderPlaces() {
    const list = filteredPlaces();

    renderList(list);
    renderMap();

    if ($("placeCount")) {
      $("placeCount").textContent = list.length + " লোকেশন";
    }
  }

  function showPlaceOnMap(id) {
    const marker = markers.get(id);

    if (!marker) {
      status("এই লোকেশনের সঠিক Pin পাওয়া যায়নি।");
      return;
    }

    const c = marker.getLatLng();

    map.setView(c, 18);
    marker.openPopup();
  }

  // FIREBASE REAL-TIME LISTENER
  function listenToPlaces() {
    sdk.onSnapshot(
      sdk.collection(db, COLLECTION),

      snapshot => {
        places = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));

        renderPlaces();

        status("লোকেশন আপডেট হয়েছে। মোট " + places.length + " টি লোকেশন।");
      },

      error => {
        console.error("Firebase Read Error:", error);
        status("Firebase Read Error: " + error.message);
      }
    );
  }

  // ADMIN FORM
  function fillForm(place) {
    selectedId = place.id;
    pendingLocation = null;

    if (pendingMarker) {
      map.removeLayer(pendingMarker);
      pendingMarker = null;
    }

    $("placeId").value = place.id;
    $("placeName").value = place.name || "";
    $("placeNote").value = place.note || "";

    if ($("placeCategory")) {
      $("placeCategory").value = place.category || "রাস মণ্ডপ";
    }

    if ($("deletePlaceBtn")) {
      $("deletePlaceBtn").disabled = false;
    }

    status("Edit Mode চালু হয়েছে।");
  }

  function resetForm() {
    selectedId = null;
    pendingLocation = null;

    if (pendingMarker && map) {
      map.removeLayer(pendingMarker);
      pendingMarker = null;
    }

    $("placeForm")?.reset();

    if ($("placeId")) {
      $("placeId").value = "";
    }

    if ($("deletePlaceBtn")) {
      $("deletePlaceBtn").disabled = true;
    }

    status("নতুন লোকেশন যোগ করতে দাঁইহাট ম্যাপে Pin বসাও।");
  }

  // SAVE LOCATION
  async function savePlace(event) {
    event.preventDefault();

    if (!isAdmin) {
      alert("প্রথমে Admin Login করো।");
      return;
    }

    const name = $("placeName")?.value.trim();

    if (!name) {
      alert("লোকেশনের নাম লিখো।");
      return;
    }

    const oldPlace = places.find(p => p.id === selectedId);

    const lat = pendingLocation?.lat ?? oldPlace?.lat ?? null;
    const lng = pendingLocation?.lng ?? oldPlace?.lng ?? null;

    if (lat == null || lng == null) {
      alert("প্রথমে ম্যাপে Pin বসাও।");
      return;
    }

    if (!DAINHAT_BOUNDS.contains(L.latLng(lat, lng))) {
      alert("শুধু দাঁইহাটের নির্দিষ্ট এলাকার মধ্যে Pin বসানো যাবে।");
      return;
    }

    const saveButton = $("placeForm")?.querySelector(
      'button[type="submit"]'
    );

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
    }

    const data = {
      name,
      note: $("placeNote")?.value.trim() || "",
      category: $("placeCategory")?.value || "অন্যান্য",
      lat: Number(lat),
      lng: Number(lng),
      updatedAt: Date.now()
    };

    try {
      if (oldPlace) {
        await sdk.setDoc(
          sdk.doc(db, COLLECTION, oldPlace.id),
          data,
          { merge: true }
        );

        status("লোকেশন Update সফল হয়েছে।");

      } else {
        await sdk.addDoc(
          sdk.collection(db, COLLECTION),
          {
            ...data,
            createdAt: Date.now()
          }
        );

        status("নতুন লোকেশন Save সফল হয়েছে।");
      }

      resetForm();

    } catch (error) {
      console.error("SAVE ERROR:", error);

      alert("Save Error: " + error.message);
      status("Save Error: " + error.message);

    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Save Location";
      }
    }
  }

  // DELETE LOCATION
  async function deletePlace() {
    if (!isAdmin || !selectedId) return;

    const place = places.find(p => p.id === selectedId);

    if (!place) return;

    if (!confirm(`"${place.name}" Delete করতে চাও?`)) return;

    try {
      await sdk.deleteDoc(
        sdk.doc(db, COLLECTION, selectedId)
      );

      resetForm();

      status("লোকেশন Delete হয়েছে।");

    } catch (error) {
      console.error(error);
      alert("Delete Error: " + error.message);
    }
  }

  // ADMIN EMAIL FIELD
  function ensureEmailField() {
    const form = $("loginForm");

    if (!form || $("adminEmail")) return;

    const wrapper = document.createElement("div");

    wrapper.innerHTML = `
      <label for="adminEmail">Admin Email</label>
      <input type="email" id="adminEmail"
        placeholder="Admin Email"
        autocomplete="username" required>
    `;

    const password = $("adminPassword");

    if (password?.parentElement) {
      password.parentElement.before(wrapper);
    } else {
      form.prepend(wrapper);
    }
  }

  // ADMIN MODE
  function setAdminMode(value) {
    isAdmin = value;

    $("adminPanel")?.classList.toggle("hidden", !value);
    $("logoutBtn")?.classList.toggle("hidden", !value);
    $("adminToggle")?.classList.toggle("hidden", value);

    if ($("mapMode")) {
      $("mapMode").textContent = value
        ? "ADMIN MODE"
        : "VIEW MODE";
    }

    if (!value) resetForm();

    renderPlaces();
  }

  // ADMIN LOGIN
  async function loginAdmin(event) {
    event.preventDefault();

    const email = $("adminEmail")?.value.trim();
    const password = $("adminPassword")?.value;

    try {
      const result = await sdk.signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (result.user.uid !== ADMIN_UID) {
        await sdk.signOut(auth);
        throw new Error("এই Account-এর Admin Access নেই।");
      }

      setAdminMode(true);

      $("loginDialog")?.close();

      status("Admin Login সফল হয়েছে।");

    } catch (error) {
      console.error(error);

      if ($("loginError")) {
        $("loginError").textContent = error.message;
      } else {
        alert(error.message);
      }
    }
  }

  async function logoutAdmin() {
    try {
      await sdk.signOut(auth);

      setAdminMode(false);

      status("Admin Logout হয়েছে।");

    } catch (error) {
      alert(error.message);
    }
  }

  // CATEGORY FILTER
  function setupCategories() {
    document.querySelectorAll("[data-category]").forEach(button => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.category || "all";

        document.querySelectorAll("[data-category]").forEach(item => {
          item.classList.remove("active");
        });

        button.classList.add("active");

        renderPlaces();
      });
    });
  }

  // GPS LOCATION
  function locateUser() {
    if (!navigator.geolocation) {
      alert("Location Support নেই।");
      return;
    }

    const button = $("locateBtn");

    if (button) {
      button.disabled = true;
      button.textContent = "লোকেশন খোঁজা হচ্ছে...";
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const point = L.latLng(
          position.coords.latitude,
          position.coords.longitude
        );

        if (!DAINHAT_BOUNDS.contains(point)) {
          alert("তোমার অবস্থান দাঁইহাট ম্যাপের বাইরে।");

          if (button) {
            button.disabled = false;
            button.textContent = "◎ আমার অবস্থান";
          }

          return;
        }

        const redPin = L.divIcon({
          className: "user-location-div-icon",
          html: '<div class="user-location-pin"><span></span></div>',
          iconSize: [30, 42],
          iconAnchor: [15, 42],
          popupAnchor: [0, -38]
        });

        // Update existing marker instead of creating duplicates
        if (userLocationMarker) {
          userLocationMarker.setLatLng(point);
          userLocationMarker.setIcon(redPin);
        } else {
          userLocationMarker = L.marker(point, {
            icon: redPin,
            zIndexOffset: 1000
          }).addTo(map);
        }

        userLocationMarker
          .bindPopup("<b>📍 তোমার বর্তমান অবস্থান</b>")
          .openPopup();

        map.setView(point, 17);

        status("তোমার বর্তমান অবস্থান দেখানো হচ্ছে।");

        if (button) {
          button.disabled = false;
          button.textContent = "◎ আমার অবস্থান";
        }
      },

      error => {
        console.error("GPS Error:", error);

        const messages = {
          1: "Location Permission চালু করো।",
          2: "তোমার অবস্থান পাওয়া যাচ্ছে না।",
          3: "GPS Timeout হয়েছে। আবার চেষ্টা করো।"
        };

        alert(messages[error.code] || "GPS Location Error হয়েছে।");

        if (button) {
          button.disabled = false;
          button.textContent = "◎ আমার অবস্থান";
        }
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }

  // ALL EVENTS
  function setupEvents() {
    $("searchInput")?.addEventListener("input", renderPlaces);

    $("placeForm")?.addEventListener("submit", savePlace);

    $("deletePlaceBtn")?.addEventListener("click", deletePlace);

    $("newPlaceBtn")?.addEventListener("click", resetForm);

    $("adminToggle")?.addEventListener("cli
