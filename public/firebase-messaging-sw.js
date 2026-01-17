/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");

// Optional: only initialize Firebase Messaging if config is provided.
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

const hasConfig = Object.values(firebaseConfig).every(Boolean);
if (hasConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || "Gymbro";
    const options = {
      body: payload?.notification?.body || "Time for the next set.",
      icon: "/icon-192.png",
    };
    self.registration.showNotification(title, options);
  });
}
