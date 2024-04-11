import { initializeApp } from '/firebase/firebase-app.js';
import { getMessaging, onMessage } from '/firebase/firebase-messaging.js';

const firebaseConfig = {
	apiKey: "AIzaSyDb-PuK9Zd1KN58n6sE77NQ01pJcGaazh4",
	authDomain: "genuine-segment-362823.firebaseapp.com",
	projectId: "genuine-segment-362823",
	storageBucket: "genuine-segment-362823.appspot.com",
	messagingSenderId: "215535108956",
	appId: "1:215535108956:web:e5d4c94fdd12c64cc4f799",
	measurementId: "G-D2R8D784CK"
};

// import { getStorage } from "/firebase/firebase-storage.js";
// import { getFirestore, collection, getDocs } from "/firebase/firebase-firestore.js";

// Initialize Firebase with a "default" Firebase project
const app = initializeApp(firebaseConfig);

console.log(app.name);  // "[DEFAULT]"

// let defaultStorage = getStorage(app);
// let defaultFirestore = getFirestore(app);

// console.log(defaultStorage)
// console.log(defaultFirestore)

// async function getCities(defaultFirestore) {
// 	const citiesCol = collection(defaultFirestore, 'cities');
// 	const citySnapshot = await getDocs(citiesCol);
// 	const cityList = citySnapshot.docs.map(doc => doc.data());
// 	return cityList;
// }

// const test = async function () {
// 	let result = await getCities(defaultFirestore);
// 	console.log(result)
// }

// test();
  
// SERVICE_NOT_AVAILABLE ???
const messaging = getMessaging(app);

onMessage(messaging, (payload) => {
	console.log('Message received. ', payload);
	// ...
  });

getToken(messaging, { vapidKey: 'BGlHHm5bF8_laKie5riglHI7uMTRUzMzflvCHc5L5BT4q8xunOqiycmytOmK3N6H6Iwh2wcFsz-zhHZUs4AHOeY' }).then((currentToken) => {
	if (currentToken) {
		console.log(currentToken)
	  // Send the token to your server and update the UI if necessary
	  // ...
	} else {
	  // Show permission request UI
	  console.log('No registration token available. Request permission to generate one.');
	  // ...
	}
  }).catch((err) => {
	console.log('An error occurred while retrieving token. ', err);
	// ...
  });


