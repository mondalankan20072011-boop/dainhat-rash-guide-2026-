/* DAINHAT RASH GUIDE 2026
   Firebase Firestore + Admin Authentication
*/
(() => {
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "PASTE_YOUR_FIREBASE_WEB_API_KEY",
    authDomain: "dainhat-rash-guide.firebaseapp.com",
    projectId: "dainhat-rash-guide",
    storageBucket: "dainhat-rash-guide.firebasestorage.app",
    messagingSenderId: "129291355113",
    appId: "1:129291355113:web:b35be037c2a5814d494178",
    measurementId: "G-E8RTZNCFPT"
  };

  const ADMIN_UID = "2FaORIg7uBcX3bd1AhLAvth8fEP2";
  const COLLECTION = "places";
  const FIREBASE_VERSION = "10.14.1";

  const $ = (id) => document.getElementById(id);

  const requiredIds = [
    "map", "searchInput", "placeCount", "placesList",
    "adminPanel", "adminToggle", "mapMode", "adminHint",
    "placeForm", "placeId", "placeName", "placeNote",
    "placeCategory", "deletePlaceBtn", "newPlaceBtn",
    "loginDialog", "loginForm", "adminPassword",
    "loginError", "cancelLogin", "logoutBtn", "locateBtn"
  ];

  const missing = requiredIds.filter((id) => !$(id));

  if (missing.length) {
    console.error("Missing HTML elements:", missing);
    alert("HTML-এ প্রয়োজনীয় ID পাওয়া যায়নি: " + missing.join(", "));
    return;
  }

  const categories = [
    "রাস মণ্ডপ",
    "Railway Station",
    "Bus Stand",
    "Parking",
    "Hospital",
    "Public Toilet"
  ];

  const initialPlaces = [
    {
      id: "seed-1",
      name: "সাহাপাড়া নাগরিক মঞ্চ",
      note: "",
      category: "রাস মণ্ডপ",
      lat: null,
      lng: null
    },
    {
      id: "seed-2",
      name: "ছোটঠাকুরুন তলা",
      note: "",
      category: "রাস মণ্ডপ",
      lat: null,
      lng: null
    },
    {
      id: "seed-3",
      name: "নটরাজ",
      note: "",
      category: "রাস মণ্ডপ",
      lat: null,
      lng: null
    },
    {
      id: "seed-4",
      name: "ব্যাংকের পাশে",
      note: "",
      category: "রাস মণ্ডপ",
      lat: null,
      lng: null
    }
  ];

  let places = [...initialPlaces];
  let selectedId = null;
  let isAdmin = false;
  let map;
  let markerLayer;
  let firebase = null;
  let unsubscribePlaces = null;
  let currentFilter = "সব";

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  function setStatus(message) {
    $("adminHint").textContent = message;
  }

  function makeId() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "place-" + Date.now();
  }

  function ensureEmailField() {
    if ($("adminEmail")) return;

    const password = $("adminPassword");

    const wrapper = document.createElement("label");
    wrapper.id = "adminEmailWrap";
    wrapper.style.display = "block";
    wrapper.style.marginBottom = "10px";

    wrapper.innerHTML = `
      <span style="display:block;margin-bottom:5px">
        Admin Email
      </span>
      <input
        id="adminEmail"
        type="email"
        autocomplete="username"
        required
        style="width:100%;box-sizing:border-box"
      >
    `;

    password.parentNode.insertBefore(wrapper, password);
  }

  async function loadFirebase() {
    if (
      FIREBASE_CONFIG.apiKey ===
      "PASTE_YOUR_FIREBASE_WEB_API_KEY"
    ) {
      throw new Error("Firebase Web API Key বসানো হয়নি।");
    }

    const base =
      `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

    const [appSdk, authSdk, dbSdk] = await Promise.all([
      import(`${base}/firebase-app.js`),
      import(`${base}/firebase-auth.js`),
      import(`${base}/firebase-firestore.js`)
    ]);

    const app = appSdk.initializeApp(FIREBASE_CONFIG);
    const auth = authSdk.getAuth(app);
    const db = dbSdk.getFirestore(app);

    firebase = {
      authSdk,
      dbSdk,
      auth,
      db
    };
  }

  function initMap() {
    map = L.map("map").setView([23.65, 88.13], 15);

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 20,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }
    ).addTo(map);

    markerLayer = L.layerGroup().addTo(map);

    map.on("click", (event) => {
      if (!isAdmin || !selectedId) return;

      const place = places.find(
        (p) => p.id === selectedId
      );

      if (!place) return;

      place.lat = Number(event.latlng.lat.toFixed(6));
      place.lng = Number(event.latlng.lng.toFixed(6));

      fillForm(place);

      setStatus(
        "ম্যাপে পিন বসানো হয়েছে। পরিবর্তন রাখতে Save চাপুন।"
      );
    });
  }
     function googleMapsUrl(place) {
    if (
      Number.isFinite(place.lat) &&
      Number.isFinite(place.lng)
    ) {
      return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      place.name + ", Dainhat, West Bengal"
    )}`;
  }

  function renderPlaces() {
    markerLayer.clearLayers();

    const query = $("searchInput").value
      .trim()
      .toLowerCase();

    const visible = places.filter((p) => {
      const matchesQuery =
        !query ||
        `${p.name} ${p.note} ${p.category}`
          .toLowerCase()
          .includes(query);

      const matchesCategory =
        currentFilter === "সব" ||
        p.category === currentFilter;

      return matchesQuery && matchesCategory;
    });

    visible.forEach((place) => {
      if (
        Number.isFinite(place.lat) &&
        Number.isFinite(place.lng)
      ) {
        const marker = L.marker([
          place.lat,
          place.lng
        ]).addTo(markerLayer);

        marker.bindPopup(`
          <strong>${escapeHTML(place.name)}</strong><br>
          ${escapeHTML(place.note)}<br>
          <a href="${googleMapsUrl(place)}"
             target="_blank"
             rel="noopener">
             Google Maps Direction
          </a>
        `);

        marker.on("click", () => {
          selectedId = place.id;
        });
      }
    });

    $("placeCount").textContent =
      `${visible.length}টি স্থান`;

    $("placesList").innerHTML = visible.map((p) => `
      <article class="place-item"
        data-place-id="${escapeHTML(p.id)}">

        <div>
          <strong>${escapeHTML(p.name)}</strong>

          <small>
            ${escapeHTML(p.category || "অন্যান্য")}
          </small>

          ${p.note
            ? `<p>${escapeHTML(p.note)}</p>`
            : ""}

          <small>
            ${
              Number.isFinite(p.lat) &&
              Number.isFinite(p.lng)
                ? "ম্যাপে পিন দেওয়া আছে"
                : "পিনের অবস্থান যোগ হয়নি"
            }
          </small>
        </div>

        <div class="place-actions">
          <a href="${googleMapsUrl(p)}"
             target="_blank"
             rel="noopener">
             Direction
          </a>

          ${
            isAdmin
              ? `<button type="button"
                   data-edit-id="${escapeHTML(p.id)}">
                   Edit
                 </button>`
              : ""
          }
        </div>
      </article>
    `).join("") || "<p>কোনও স্থান পাওয়া যায়নি।</p>";

    $("placesList")
      .querySelectorAll("[data-edit-id]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const place = places.find(
            (p) => p.id === button.dataset.editId
          );

          if (place) selectPlace(place);
        });
      });
  }

  function fillForm(place) {
    $("placeId").value = place?.id || "";
    $("placeName").value = place?.name || "";
    $("placeNote").value = place?.note || "";
    $("placeCategory").value =
      place?.category || categories[0];
  }

  function selectPlace(place) {
    selectedId = place.id;
    fillForm(place);

    if (
      Number.isFinite(place.lat) &&
      Number.isFinite(place.lng)
    ) {
      map.setView(
        [place.lat, place.lng],
        18
      );
    }

    if (isAdmin) {
      setStatus(
        "স্থানটি সম্পাদনা করতে তথ্য বদলে Save চাপুন।"
      );
    }
  }

  async function savePlace(event) {
    event.preventDefault();

    if (!isAdmin || !firebase) return;

    const id = $("placeId").value || makeId();

    const old = places.find(
      (p) => p.id === id
    );

    const place = {
      id,
      name: $("placeName").value.trim(),
      note: $("placeNote").value.trim(),
      category:
        $("placeCategory").value || categories[0],
      lat: old?.lat ?? null,
      lng: old?.lng ?? null,
      updatedAt: new Date().toISOString()
    };

    if (!place.name) {
      alert("স্থানের নাম লিখুন।");
      return;
    }

    try {
      await firebase.dbSdk.setDoc(
        firebase.dbSdk.doc(
          firebase.db,
          COLLECTION,
          id
        ),
        place
      );

      selectedId = id;
      setStatus("স্থানটি সংরক্ষণ হয়েছে।");

    } catch (error) {
      console.error(error);
      alert(
        "সংরক্ষণ করা যায়নি: " + error.message
      );
    }
  }

  async function deletePlace() {
    if (!isAdmin || !firebase) return;

    const id = $("placeId").value;

    if (!id) return;

    const place = places.find(
      (p) => p.id === id
    );

    if (
      !place ||
      !confirm(`“${place.name}” মুছে ফেলবেন?`)
    ) {
      return;
    }

    try {
      await firebase.dbSdk.deleteDoc(
        firebase.dbSdk.doc(
          firebase.db,
          COLLECTION,
          id
        )
      );

      selectedId = null;
      fillForm(null);

      setStatus("স্থানটি মুছে ফেলা হয়েছে।");

    } catch (error) {
      console.error(error);
      alert(
        "মুছতে সমস্যা হয়েছে: " + error.message
      );
    }
  }
     async function seedInitialPlacesIfEmpty() {
    const {
      collection,
      getDocs,
      writeBatch,
      doc
    } = firebase.dbSdk;

    const ref = collection(
      firebase.db,
      COLLECTION
    );

    const snapshot = await getDocs(ref);

    if (!snapshot.empty) return;

    const batch = writeBatch(firebase.db);

    initialPlaces.forEach((place) => {
      batch.set(
        doc(firebase.db, COLLECTION, place.id),
        place
      );
    });

    await batch.commit();
  }

  function listenToPlaces() {
    const ref = firebase.dbSdk.collection(
      firebase.db,
      COLLECTION
    );

    unsubscribePlaces =
      firebase.dbSdk.onSnapshot(
        ref,
        (snapshot) => {
          places = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data()
          }));

          if (!places.length) {
            places = [...initialPlaces];
          }

          renderPlaces();
        },
        (error) => {
          console.error(error);

          setStatus(
            "Firebase থেকে তথ্য পাওয়া যাচ্ছে না: " +
            error.message
          );
        }
      );
  }

  async function login(event) {
    event.preventDefault();

    if (!firebase) return;

    $("loginError").textContent = "";

    try {
      const credential =
        await firebase.authSdk.signInWithEmailAndPassword(
          firebase.auth,
          $("adminEmail").value.trim(),
          $("adminPassword").value
        );

      if (credential.user.uid !== ADMIN_UID) {
        await firebase.authSdk.signOut(
          firebase.auth
        );

        $("loginError").textContent =
          "এই অ্যাকাউন্টটি Admin নয়।";
      }

    } catch (error) {
      $("loginError").textContent =
        "Login হয়নি। Email/Password পরীক্ষা করুন।";

      console.error(error);
    }
  }

  function setAdminMode(user) {
    isAdmin =
      !!user && user.uid === ADMIN_UID;

    $("adminPanel").hidden = !isAdmin;
    $("logoutBtn").hidden = !isAdmin;
    $("adminToggle").hidden = isAdmin;

    $("adminHint").textContent = isAdmin
      ? "Admin Mode চালু। ম্যাপে ক্লিক করে পিন বসিয়ে Save করুন।"
      : "সাধারণ দর্শক মোড";

    renderPlaces();

    if (
      isAdmin &&
      $("loginDialog").close
    ) {
      $("loginDialog").close();
    }
  }

  function setupCategoryFilter() {
    const host = $("mapMode");

    const select = document.createElement("select");

    select.id = "categoryFilter";
    select.setAttribute(
      "aria-label",
      "Category filter"
    );

    select.style.margin = "6px";

    select.innerHTML = [
      "সব",
      ...categories
    ].map((c) => `
      <option value="${escapeHTML(c)}">
        ${escapeHTML(c)}
      </option>
    `).join("");

    host.insertAdjacentElement(
      "afterend",
      select
    );

    select.addEventListener("change", () => {
      currentFilter = select.value;
      renderPlaces();
    });
  }

  function setupEvents() {
    ensureEmailField();
    setupCategoryFilter();

    $("searchInput").addEventListener(
      "input",
      renderPlaces
    );

    $("placeForm").addEventListener(
      "submit",
      savePlace
    );

    $("deletePlaceBtn").addEventListener(
      "click",
      deletePlace
    );

    $("newPlaceBtn").addEventListener(
      "click",
      () => {
        selectedId = null;
        fillForm(null);
        setStatus("নতুন স্থানের নাম লিখুন।");
      }
    );

    $("adminToggle").addEventListener(
      "click",
      () => {
        if ($("loginDialog").showModal) {
          $("loginDialog").showModal();
        } else {
          $("loginDialog").hidden = false;
        }
      }
    );

    $("loginForm").addEventListener(
      "submit",
      login
    );

    $("cancelLogin").addEventListener(
      "click",
      () => {
        if ($("loginDialog").close) {
          $("loginDialog").close();
        } else {
          $("loginDialog").hidden = true;
        }
      }
    );

    $("logoutBtn").addEventListener(
      "click",
      () => firebase?.authSdk.signOut(
        firebase.auth
      )
    );

    $("locateBtn").addEventListener(
      "click",
      () => {
        if (!navigator.geolocation) {
          alert("এই ব্রাউজারে Location সুবিধা নেই।");
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const latlng = [
              position.coords.latitude,
              position.coords.longitude
            ];

            map.setView(latlng, 17);

            L.circleMarker(latlng, {
              radius: 8
            })
              .addTo(map)
              .bindPopup("আপনার বর্তমান অবস্থান")
              .openPopup();
          },
          (error) => {
            alert(
              "Location পাওয়া যায়নি: " +
              error.message
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 12000
          }
        );
      }
    );
  }

  async function start() {
    if (typeof L === "undefined") {
      alert(
        "Leaflet map library লোড হয়নি।"
      );
      return;
    }

    initMap();
    setupEvents();
    renderPlaces();

    try {
      await loadFirebase();

      listenToPlaces();

      firebase.authSdk.onAuthStateChanged(
        firebase.auth,
        async (user) => {
          setAdminMode(
            user && user.uid === ADMIN_UID
              ? user
              : null
          );

          if (
            user &&
            user.uid === ADMIN_UID
          ) {
            try {
              await seedInitialPlacesIfEmpty();
            } catch (error) {
              console.error(error);

              setStatus(
                "প্রাথমিক স্থান যোগ করা যায়নি: " +
                error.message
              );
            }
          }
        }
      );

    } catch (error) {
      console.error(error);

      setStatus(
        "Firebase চালু হয়নি: " +
        error.message
      );

      alert(
        "Firebase সেটআপে সমস্যা: " +
        error.message
      );
    }
  }

  window.DainhatApp = {
    edit: (id) => {
      const place = places.find(
        (p) => p.id === id
      );

      if (place) selectPlace(place);
    }
  };

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }

})();
   
