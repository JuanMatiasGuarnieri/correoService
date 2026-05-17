const firebaseConfig = {
    apiKey: "API KEY DE FIREBASE",
    authDomain: "DOMINIO DE LA BD DE FIREBASE",
    databaseURL: "URL DE LA BASE DE DATOS DE FIREBASE",
    projectId: "ID DE PROYECTO",
    storageBucket: "STORAGE DE FIREBASE",
    messagingSenderId: "851994949651",
    appId: "1:851994949651:web:836e718f630aadf7aaa7e6",
    measurementId: "G-WN36724L4C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
