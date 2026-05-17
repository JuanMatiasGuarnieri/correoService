const firebaseConfig = {
    apiKey: "AIzaSyDsW0BOCa-O90zy2RfuEfLACSBXOHFjwGE",
    authDomain: "correo-fleet.firebaseapp.com",
    databaseURL: "https://correo-fleet-default-rtdb.firebaseio.com",
    projectId: "correo-fleet",
    storageBucket: "correo-fleet.firebasestorage.app",
    messagingSenderId: "851994949651",
    appId: "1:851994949651:web:836e718f630aadf7aaa7e6",
    measurementId: "G-WN36724L4C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
