const express = require('express');
const path = require('path');
const app = express();

// --- START: NEW FIRESTORE ADMIN SDK INTEGRATION ---
// This part allows your server to interact with Firestore directly
const admin = require("firebase-admin");

// The 'FIREBASE_SERVICE_ACCOUNT' environment variable is where your service account key lives,
// securely configured in Google Cloud Secret Manager and apphosting.yaml.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get a reference to the Firestore database for server-side use
const firestoreDb = admin.firestore();

// This middleware is necessary to parse JSON payloads sent to your server,
// like when a client wants to send data to your new API endpoint.
app.use(express.json());

// A new API endpoint for your server to add data to Firestore.
// Your client-side app could make a POST request to this endpoint.
app.post('/api/add-data', async (req, res) => {
    const appId = "my_id"; // The specific ID for your data in Firestore
    const messageId = Date.now().toString(); // Generate a unique ID for the message
    const dataToAdd = req.body; // The data sent by the client in the request body

    try {
        // Construct the Firestore path and add the data
        const docRef = firestoreDb.collection('artifacts').doc(appId)
                                 .collection('public').doc('data')
                                 .collection('test_messages').doc(messageId);
        await docRef.set(dataToAdd);
        console.log(`Server: Data ${messageId} successfully added to Firestore.`);
        res.status(201).send({ status: 'success', message: 'Data added successfully', id: messageId });
    } catch (error) {
        console.error('Server: Error adding data to Firestore:', error);
        res.status(500).send({ status: 'error', message: 'Failed to add data' });
    }
});
// The hosting environment automatically sets the PORT environment variable.
// We default to 8080 if it's not set (e.g., for local testing).
const PORT = process.env.PORT || 8080;

// Tell Express to serve all static files (like your HTML and PWA assets)
// from the 'public' folder, as defined in your firebase.json.
app.use(express.static(path.join(__dirname, 'public')));

// Since your main file is named 'firebase_tester.html', we ensure that
// requests to the root '/' path are served this file.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server and listen on the required port.
app.listen(PORT, '0.0.0.0', () => { // <-- ADDED '0.0.0.0' HERE!
    console.log(`Web App Server started successfully and listening on port ${PORT}`);
    console.log(`Firestore connected. You can now send POST requests to /api/add-data`);
});
