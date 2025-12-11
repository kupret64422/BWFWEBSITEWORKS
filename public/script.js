// --- HARDCODED FIREBASE CONFIGURATION (From your project) ---
// NOTE: This configuration must be correctly set up in your Firebase console.
const firebaseConfig = {
    apiKey: "AIzaSyBUZSxkcJurZs6677HRFsXNFiyHhjrnvI0",
    authDomain: "freecatpwa.firebaseapp.com",
    projectId: "freecatpwa",
    storageBucket: "freecatpwa.firebasestorage.app",
    messagingSenderId: "736427641196",
    appId: "1:736427641196:web:6ddd72b3aa1e6c98cfcb49",
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    signOut, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, onSnapshot, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

const appId = firebaseConfig.projectId || 'default-cat-app'; 

let db, auth, userId, storage;
let allMemories = [];
let currentFilter = '';

// --- PREDEFINED TAGS ---
const PREDEFINED_TAGS = [
    'Brown', 'Black', 'White', 'Black+White', 'Kitten', 'Outside', 'Indoors',
    'Sleeping', 'Cute', 'Fluffy', 'Crazy', 'Close-up', 'Far away', "Bird's eye",
    'Fancy', 'Cone', 'Loaf', 'Sneaky', 'Tabby', 'Domestic shorthair', 'Grey',
    'Siamese', 'Orange', 'Maine Coon', 'Ragdoll', 'Bengal', 'Persian', 'Bobtail',
    'Naughty', 'Eating', 'Frightened', 'Sphynx', 'Beans', 'Paw', 'Tail'
].map(tag => tag.toLowerCase());

// DOM Elements
const gallery = document.getElementById('catGallery');
const countDisplay = document.getElementById('countDisplay');
const uploadForm = document.getElementById('uploadForm');
const imageUpload = document.getElementById('imageUpload');
const submitBtn = document.getElementById('submitBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const userInfo = document.getElementById('userInfo');
const tagSelector = document.getElementById('tagSelector');
const selectedTagsHidden = document.getElementById('selectedTagsHidden');
const noResults = document.getElementById('noResults');

// New Auth DOM Elements
const authScreen = document.getElementById('authScreen');
const galleryScreen = document.getElementById('galleryScreen');
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authMessage = document.getElementById('authMessage');
const logoutBtn = document.getElementById('logoutBtn');
const headerSubtitle = document.getElementById('headerSubtitle');

// NEW PREVIEW ELEMENTS
const imagePreview = document.getElementById('imagePreview');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');

// NEW CUSTOM TAG INPUT ELEMENT
const customTagsInput = document.getElementById('customTags');

let isAuthReady = false;

// --- UTILITY FUNCTIONS ---
function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `p-3 mb-4 rounded-lg text-sm ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
    element.classList.remove('hidden');
    setTimeout(() => {
        element.classList.add('hidden');
    }, 5000);
}

function updateHiddenTags() {
    // This function primarily updates the hidden field based on predefined tags
    const selected = Array.from(tagSelector.querySelectorAll('.tag-selected'))
        .map(btn => btn.getAttribute('data-tag'));
    selectedTagsHidden.value = selected.length > 0 ? selected.join('|') : '';
}

// --- TAG SELECTOR UI ---

function renderTagSelector() {
    PREDEFINED_TAGS.forEach(tag => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
        button.setAttribute('data-tag', tag);
        button.className = 'tag-pill px-3 py-1 text-xs font-medium rounded-full transition duration-150 ease-in-out border border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-200';
        
        button.addEventListener('click', () => {
            button.classList.toggle('tag-selected');
            
            if (button.classList.contains('tag-selected')) {
                button.classList.remove('bg-violet-50', 'text-violet-700');
                button.classList.add('bg-violet-600', 'text-white');
            } else {
                button.classList.add('bg-violet-50', 'text-violet-700');
                button.classList.remove('bg-violet-600', 'text-white');
            }
            
            updateHiddenTags();
        });
        tagSelector.appendChild(button);
    });
}

// --- IMAGE PREVIEW LOGIC ---
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            imagePreview.src = event.target.result;
            imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        imagePreviewContainer.classList.add('hidden');
        imagePreview.src = '#';
    }
});

// --- FIREBASE INITIALIZATION AND AUTHENTICATION ---

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app); 
    
    // Listen for auth state changes
    onAuthStateChanged(auth, (user) => {
        isAuthReady = true;
        if (user) {
            // User is signed in.
            userId = user.uid;
            userInfo.textContent = `Logged in as: ${user.email} (ID: ${userId.substring(0, 8)}...)`;
            headerSubtitle.textContent = 'Upload and search for your favorite cat moments!';
            authScreen.classList.add('hidden');
            galleryScreen.classList.remove('hidden');
            setupRealtimeListener(); // Start listening for data now that user is logged in
        } else {
            // User is signed out.
            userId = null;
            userInfo.textContent = 'Please log in or sign up.';
            headerSubtitle.textContent = 'Sign in to share your cat moments!';
            authScreen.classList.remove('hidden');
            galleryScreen.classList.add('hidden');
        }
    });
    
} catch (e) {
    console.error("Firebase Initialization Failed:", e);
    showMessage(authMessage, "Failed to initialize the app. Check console for details.", 'error');
}

// --- AUTHENTICATION HANDLERS ---

authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const action = e.submitter.getAttribute('data-action') || 'login';
    handleAuth(action);
});

authForm.querySelector('[data-action="signup"]').addEventListener('click', (e) => {
    e.preventDefault();
    handleAuth('signup');
});

async function handleAuth(action) {
    const email = emailInput.value;
    const password = passwordInput.value;

    if (password.length < 6) {
        showMessage(authMessage, "Password must be at least 6 characters long.", 'error');
        return;
    }

    try {
        if (action === 'signup') {
            showMessage(authMessage, "Creating account...", 'success');
            await createUserWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged handles screen change upon success
        } else if (action === 'login') {
            showMessage(authMessage, "Logging in...", 'success');
            await signInWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged handles screen change upon success
        }
        emailInput.value = '';
        passwordInput.value = '';

    } catch (error) {
        console.error("Auth Error:", error);
        let msg = 'An unknown authentication error occurred.';
        if (error.code) {
            msg = error.message.replace('Firebase:', '').trim();
            if (msg.includes('(auth/')) {
                msg = msg.split('(auth/')[0].trim();
            }
        }
        showMessage(authMessage, `Authentication Failed: ${msg}`, 'error');
    }
}

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        // onAuthStateChanged handles screen change upon success
    } catch (error) {
        console.error("Logout Error:", error);
    }
});


// --- FIRESTORE OPERATIONS ---

const COLLECTION_PATH = `artifacts/${appId}/public/data/cat_memories`;

/**
 * Sets up the real-time listener for the cat memories collection.
 */
function setupRealtimeListener() {
    if (!db || !userId) return; // Only run if DB initialized and user logged in

    const q = query(collection(db, COLLECTION_PATH));

    onSnapshot(q, (snapshot) => {
        allMemories = [];
        snapshot.forEach((doc) => {
            allMemories.push({ id: doc.id, ...doc.data() });
        });
        // Rerun filter to update the display with new data
        filterImages(currentFilter); 
    }, (error) => {
        console.error("Error fetching data:", error);
        showMessage(document.getElementById('uploadMessage'), "Failed to load cat memories. Please check Firestore security rules.", 'error');
    });
}

/**
 * Handles the image upload, saves the image to Storage, and saves the URL to Firestore.
 */
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!userId) {
        showMessage(document.getElementById('uploadMessage'), "You must be logged in to upload a photo.", 'error');
        return;
    }

    const file = imageUpload.files[0];
    
    // 1. Get predefined tags
    const selectedTagButtons = tagSelector.querySelectorAll('.tag-selected');
    const rawTagsFromPredefined = Array.from(selectedTagButtons).map(btn => btn.getAttribute('data-tag'));
    
    // 2. Get and clean custom tags from the new input field
    const customTags = customTagsInput.value.toLowerCase()
        .split(/[\s,]+/) // Split by spaces or commas
        .map(tag => tag.trim()) // Trim whitespace from each tag
        .filter(tag => tag.length > 0); // Remove empty strings

    // 3. Combine both lists and ensure all tags are unique
    let rawTags = [...new Set([...rawTagsFromPredefined, ...customTags])];
    
    if (!file || rawTags.length === 0) {
        showMessage(document.getElementById('uploadMessage'), "Please select an image and at least one tag (predefined or custom).", 'error');
        return;
    }

    submitBtn.disabled = true;
    loadingIndicator.classList.remove('hidden');

    try {
        // 1. Define the storage path
        const filePath = `cat_photos/${userId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath); 

        // 2. Upload the file
        await uploadBytes(storageRef, file, { contentType: file.type });

        // 3. Get the public download URL
        const imageUrl = await getDownloadURL(storageRef);

        // 4. Add document to Firestore
        await addDoc(collection(db, COLLECTION_PATH), {
            userId: userId,
            timestamp: serverTimestamp(),
            tags: rawTags, // Save the combined list of tags
            imageUrl: imageUrl,
        });

        showMessage(document.getElementById('uploadMessage'), "Cat photo uploaded successfully! 😻", 'success');
        
        // Clear form and preview
        uploadForm.reset();
        imagePreviewContainer.classList.add('hidden');
        imagePreview.src = '#'; 
        customTagsInput.value = ''; // Clear custom input
        tagSelector.querySelectorAll('.tag-pill').forEach(btn => {
            btn.classList.remove('tag-selected', 'bg-violet-600', 'text-white');
            btn.classList.add('bg-violet-50', 'text-violet-700');
        });
        updateHiddenTags();

    } catch (error) {
        console.error("Error uploading photo:", error);
        if (error.code === 'storage/unauthorized') {
            showMessage(document.getElementById('uploadMessage'), 'Upload failed: Permission denied. Check Storage Rules and ensure you are logged in!', 'error');
        } else {
            showMessage(document.getElementById('uploadMessage'), `Upload failed: ${error.message || 'An unknown error occurred.'}`, 'error');
        }
    } finally {
        submitBtn.disabled = false;
        loadingIndicator.classList.add('hidden');
    }
});

// --- GALLERY RENDERING AND FILTERING ---

function renderGallery(filteredMemories) {
    gallery.innerHTML = '';
    countDisplay.textContent = filteredMemories.length;

    const noResults = document.getElementById('noResults');
    if (filteredMemories.length === 0) {
        noResults.classList.remove('hidden');
        return;
    } else {
        noResults.classList.add('hidden');
    }

    filteredMemories.forEach(memory => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-lg overflow-hidden transition transform hover:scale-[1.02] duration-300';

        const tagsHtml = (memory.tags || []).map(tag => 
            `<span class="inline-block bg-violet-100 text-violet-800 text-xs font-medium px-2.5 py-0.5 rounded-full mr-1 mb-1">${tag.charAt(0).toUpperCase() + tag.slice(1)}</span>`
        ).join('');

        card.innerHTML = `
            <img src="${memory.imageUrl || 'https://placehold.co/400x300/e0e0e0/555?text=Missing+Image'}" 
                alt="Cat Photo with tags: ${memory.tags ? memory.tags.join(', ') : 'none'}"
                class="w-full h-48 object-cover object-center"
                onerror="this.onerror=null;this.src='https://placehold.co/400x300/e0e0e0/555?text=Image+Failed+to+Load';">
            <div class="p-4">
                <div class="flex flex-wrap mb-2">
                    ${tagsHtml}
                </div>
                <p class="text-xs text-gray-500">Uploaded by: ${memory.userId.substring(0, 6)}...</p>
            </div>
        `;

        gallery.appendChild(card);
    });
}

// Global function called by the search input (oninput)
window.filterImages = (rawQuery) => {
    currentFilter = rawQuery;
    // Split the search query by spaces or commas, and convert to lower case
    const searchTags = rawQuery.toLowerCase().split(/[ ,]+/).filter(tag => tag.length > 0);

    if (searchTags.length === 0) {
        // If the search bar is empty, show all memories
        renderGallery(allMemories);
        return;
    }

    const filtered = allMemories.filter(memory => {
        if (!memory.tags) return false;
        
        // CRITERIA: The memory must contain ALL of the search terms entered.
        return searchTags.every(searchTag =>
            memory.tags.some(memoryTag => memoryTag.includes(searchTag))
        );
    });

    renderGallery(filtered);
};

// --- INITIALIZATION ---

renderTagSelector();
