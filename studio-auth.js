import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';
import {firebaseConfig} from './firebase-config.js';

// Begin restoring the session independently of Firestore and Functions.
export const app=initializeApp(firebaseConfig,'fashion-futures');
export const auth=getAuth(app);
