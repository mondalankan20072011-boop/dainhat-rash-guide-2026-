
/* DAINHAT RASH GUIDE 2026
   Firebase + Leaflet
   Location List + Map Pins
   Admin Add / Edit / Delete
   Google Maps Directions
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

  const $ = id => document.getElementById(id);

  let db, auth, sdk, map, markerLayer;
  let places = [];
  let markers = new Map();
  let isAdmin = false;
  let selectedId = null;
  let pendingLocation = null;
  let activeCategory = "all";

  function status(message) {
    if ($("adminHint")) {
      $("adminHint").textContent = message;
    }
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

  function validCoordinates(lat, lng) {
    return Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng)) &&
      Math.abs(Number(lat)) <= 90 &&
      Math.abs(Number(lng)) <= 180;
  }

  function coordinates(place) {
    if (!validCoordinates(place.lat, place.lng)) return null;

    return {
      lat: Number(place.lat),
      lng: Number(place.lng)
    };
  }

  function directionURL(place) {
    const c = coordinates(place);
    const destination = c
      ? `${c.lat},${c.lng}`
      : place.name;

    return "https://www.google.com/maps/dir/?api=1&destination=" +
      encodeURIComponent(destination);
  }

  async function initializeFirebase() {
    const [app, firestore, authentication] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${VERSION}/firebase-auth.js`)
    ]);

    const firebaseApp = app.initializeApp(FIREBASE_CONFIG);

    db = firestore.getFirestore(firebaseApp);
    auth = authentication.getAuth(firebaseApp);

    sdk = {
      ...firestore,
      ...authentication
    };
  }

  function initializeMap() {
    if (typeof L === "undefined" || !$("map")) {
      throw new Error("Map বা Leaflet পাওয়া যায়নি।");
    }

    map = L.map("map").setView(
      [23.6063, 88.1715],
      15
    );

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
      }
    ).addTo(map);

    markerLayer = L.layerGroup().addTo(map);

    map.on("click", event => {
      if (!isAdmin) return;

      pendingLocation = {
        lat: event.latlng.lat,
        lng: event.latlng.lng
      };

      status("Map Pin বসানো হয়েছে। এবার Save করো।");
    });
  }

  async function seedInitialPlacesIfEmpty() {
    const ref = sdk.collection(db, COLLECTION);
    const snapshot = await sdk.getDocs(ref);

    if (!snapshot.empty) return;

    const initialPlaces = [
      {
        name: "সাহাপাড়া নাগরিক মঞ্চ",
        category: "প্যান্ডেল",
        note: "",
        lat: null,
        lng: null
      },
      {
        name: "ছোটঠাকুরুন তলা",
        category: "প্যান্ডেল",
        note: "",
        lat: null,
        lng: null
      },
      {
        name: "নটরাজ",
        category: "প্যান্ডেল",
        note: "",
        lat: null,
        lng: null
      },
      {
        name: "ব্যাংকের পাশে",
        category: "অন্যান্য",
        note: "",
        lat: null,
        lng: null
      }
    ];

    for (const place of initialPlaces) {
      await sdk.addDoc(ref, {
        ...place,
        createdAt: Date.now()
      });
    }
  }

  function listenToPlaces() {
    const ref = sdk.collection(db, COLLECTION);

    sdk.onSnapshot(ref, snapshot => {
      places = snapshot.docs.map(document => {
        const data = document.data();

        return {
          id: document.id,
          ...data,
          lat: data.lat == null ? null : Number(data.lat),
          lng: data.lng == null ? null : Number(data.lng)
        };
      });

      renderPlaces();

    }, error => {
      console.error(error);
      status("Firebase Error: " + error.message);
    });
  }

  function filteredPlaces() {
    const search = ($("searchInput")?.value || "")
      .trim()
      .toLowerCase();

    return places.filter(place => {
      const matchesSearch =
        !search ||
        String(place.name || "").toLowerCase().includes(search) ||
        String(place.note || "").toLowerCase().includes(search);

      const matchesCategory =
        activeCategory === "all" ||
        place.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }

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
    link.textContent = "Direction দেখুন";

    box.append(title);

    if (place.note) box.append(note);

    box.append(link);

    return box;
  }

  function renderMap(list) {
    markerLayer.clearLayers();
    markers.clear();

    list.forEach(place => {
      const c = coordinates(place);
      if (!c) return;

      const marker = L.marker([c.lat, c.lng]);

      marker.bindPopup(createPopup(place));
      marker.addTo(markerLayer);

      markers.set(place.id, marker);
    });
  }

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

        <div class="place-info">
          <h3>${escapeHTML(place.name)}</h3>
          <p>${escapeHTML(place.note || "")}</p>
          <small>${escapeHTML(place.category || "অন্যান্য")}</small>
        </div>

        <div class="place-actions">

          <button
            type="button"
            class="view-place-btn"
            data-id="${escapeHTML(place.id)}">
            ${coordinates(place) ? "Map দেখুন" : "Location নেই"}
          </button>

          <a
            class="direction-btn"
            href="${escapeHTML(directionURL(place))}"
            target="_blank"
            rel="noopener noreferrer">
            Direction
          </a>

          ${isAdmin ? `
            <button
              type="button"
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
    renderMap(list);

    if ($("placeCount")) {
      $("placeCount").textContent = list.length;
    }
  }

  function showPlaceOnMap(id) {
    const marker = markers.get(id);

    if (!marker) {
      status("এই লোকেশনের Pin এখনও বসানো হয়নি।");
      return;
    }

    const place = places.find(p => p.id === id);
    const c = coordinates(place);

    map.setView([c.lat, c.lng], 18);
    marker.openPopup();
  }

  function fillForm(place) {
    selectedId = place.id;
    pendingLocation = null;

    $("placeId").value = place.id;
    $("placeName").value = place.name || "";
    $("placeNote").value = place.note || "";

    if ($("placeCategory")) {
      $("placeCategory").value =
        place.category || "অন্যান্য";
    }

    if ($("deletePlaceBtn")) {
      $("deletePlaceBtn").disabled = false;
    }

    status("Edit করতে পারো। Pin পরিবর্তন করতে Map-এ ক্লিক করো।");
  }

  function resetForm() {
    selectedId = null;
    pendingLocation = null;

    $("placeForm")?.reset();

    if ($("placeId")) $("placeId").value = "";

    if ($("deletePlaceBtn")) {
      $("deletePlaceBtn").disabled = true;
    }

    status("নতুন লোকেশন যোগ করতে Map-এ Pin বসাও।");
  }

  async function savePlace(event) {
    event.preventDefault();

    if (!isAdmin) return;

    const name = $("placeName")?.value.trim();

    if (!name) {
      alert("লোকেশনের নাম লিখো।");
      return;
    }

    const oldPlace = places.find(p => p.id === selectedId);

    const lat = pendingLocation?.lat ?? oldPlace?.lat ?? null;
    const lng = pendingLocation?.lng ?? oldPlace?.lng ?? null;

    if (!validCoordinates(lat, lng)) {
      alert("প্রথমে Map-এ ক্লিক করে Pin বসাও।");
      return;
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

        status("লোকেশন Update হয়েছে।");

      } else {
        await sdk.addDoc(
          sdk.collection(db, COLLECTION),
          {
            ...data,
            createdAt: Date.now()
          }
        );

        status("নতুন লোকেশন যোগ হয়েছে।");
      }

      resetForm();

    } catch (error) {
      console.error(error);
      alert("Save Error: " + error.message);
    }
  }

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
      alert(error.message);
    }
  }

  function ensureEmailField() {
    const form = $("loginForm");

    if (!form || $("adminEmail")) return;

    const wrapper = document.createElement("div");

    wrapper.innerHTML = `
      <label for="adminEmail">Admin Email</label>
      <input
        type="email"
        id="adminEmail"
        placeholder="Admin Email"
        autocomplete="username"
        required
      >
    `;

    const password = $("adminPassword");

    if (password?.parentElement) {
      password.parentElement.before(wrapper);
    } else {
      form.prepend(wrapper);
    }
  }

  function setAdminMode(value) {
    isAdmin = value;

    $("adminPanel")?.classList.toggle("hidden", !value);
    $("logoutBtn")?.classList.toggle("hidden", !value);
    $("adminToggle")?.classList.toggle("hidden", value);

    if (!value) resetForm();

    renderPlaces();
  }

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
    await sdk.signOut(auth);
    setAdminMode(false);
    status("Admin Logout হয়েছে।");
  }

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

  function setupEvents() {
    $("searchInput")?.addEventListener("input", renderPlaces);

    $("placeForm")?.addEventListener("submit", savePlace);

    $("deletePlaceBtn")?.addEventListener("click", deletePlace);

    $("newPlaceBtn")?.addEventListener("click", resetForm);

    $("adminToggle")?.addEventListener("click", () => {
      ensureEmailField();
      $("loginDialog")?.showModal();
    });

    $("loginForm")?.addEventListener("submit", loginAdmin);

    $("cancelLogin")?.addEventListener("click", () => {
      $("loginDialog")?.close();
    });

    $("logoutBtn")?.addEventListener("click", logoutAdmin);

    $("locateBtn")?.addEventListener("click", () => {
      if (!navigator.geolocation) {
        alert("Location Support নেই।");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          map.setView([
            position.coords.latitude,
            position.coords.longitude
          ], 17);
        },
        () => alert("Location Permission চালু করো।")
      );
    });

    $("placesList")?.addEventListener("click", event => {
      const view = event.target.closest(".view-place-btn");
      const edit = event.target.closest(".edit-place-btn");

      if (view) {
        showPlaceOnMap(view.dataset.id);
        return;
      }

      if (edit && isAdmin) {
        const place = places.find(p => p.id === edit.dataset.id);

        if (place) {
          fillForm(place);

          if (coordinates(place)) {
            showPlaceOnMap(place.id);
          }
        }
      }
    });

    setupCategories();
  }

  async function startApp() {
    try {
      status("App Loading হচ্ছে...");

      await initializeFirebase();

      initializeMap();

      setupEvents();

      await seedInitialPlacesIfEmpty();

      listenToPlaces();

      ensureEmailField();

      sdk.onAuthStateChanged(auth, user => {
        setAdminMode(
          !!user && user.uid === ADMIN_UID
        );
      });

      status("DAINHAT RASH GUIDE 2026 Ready!");

    } catch (error) {
      console.error(error);
      status("App Error: " + error.message);
    }
  }

  document.addEventListener("DOMContentLoaded", startApp);

})();
         
