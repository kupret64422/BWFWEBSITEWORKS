const express = require('express');
const path = require('path');
const app = express();

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
app.listen(PORT, () => {
    console.log(`Web App Server started successfully and listening on port ${PORT}`);
});
