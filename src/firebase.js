import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDCNCYf0jP38sMHx1Oh8sYv_kKNdbVT84s",
  authDomain: "go-rescue-database.firebaseapp.com",
  databaseURL: "https://go-rescue-database-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "go-rescue-database",
  storageBucket: "go-rescue-database.appspot.com",
  messagingSenderId: "389741892505",
  appId: "1:389741892505:web:1f92bbe55da184f5aff908",
  measurementId: "G-KESJ6TZM1P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);  // ✅ Remove the circular reference (was initializeApp(app))

// Get Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);