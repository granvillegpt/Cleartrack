// FIXED PRACTITIONER CODE LOADING - Complete rebuild
// This ensures the practitioner code loads properly from Firestore

(function() {
    'use strict';
    
    // Global practitioner object
    window.practitioner = window.practitioner || null;
    let isInitializing = false;
    let isInitialized = false;
    
    // Generate a unique practitioner code
    function generatePractitionerCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    // Load practitioner from Firestore - SIMPLIFIED AND FIXED
    async function loadPractitionerFromFirestore(uid) {
        try {
            console.log('Loading practitioner from Firestore for UID:', uid);
            
            const db = firebase.firestore();
            const practitionerRef = db.collection('practitioners').doc(uid);
            
            // Set a timeout for the Firestore call
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Firestore timeout')), 10000)
            );
            
            const docPromise = practitionerRef.get();
            const doc = await Promise.race([docPromise, timeoutPromise]);
            
            if (doc.exists) {
                const data = doc.data();
                console.log('Practitioner data loaded:', data);
                
                // Ensure practitionerCode exists
                let practitionerCode = data.practitionerCode;
                
                if (!practitionerCode || practitionerCode === '') {
                    console.log('No practitioner code found, generating new one...');
                    practitionerCode = generatePractitionerCode();
                    
                    // Save the new code to Firestore
                    await practitionerRef.update({
                        practitionerCode: practitionerCode,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    console.log('Generated and saved new practitioner code:', practitionerCode);
                }
                
                // Create practitioner object
                window.practitioner = {
                    uid: uid,
                    email: data.email || '',
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    practitionerCode: practitionerCode,
                    profileImage: data.profileImage || '',
                    createdAt: data.createdAt || null,
                    updatedAt: data.updatedAt || null
                };
                
                // Update local storage for caching
                try {
                    localStorage.setItem('practitioner', JSON.stringify(window.practitioner));
                } catch (e) {
                    console.warn('Could not save to localStorage:', e);
                }
                
                // Update the interface immediately
                updatePractitionerInterface();
                
                return window.practitioner;
            } else {
                console.log('Practitioner document does not exist, creating...');
                return await createPractitionerInFirestore(uid);
            }
        } catch (error) {
            console.error('Error loading practitioner from Firestore:', error);
            
            // Try to load from local storage as fallback
            try {
                const cached = localStorage.getItem('practitioner');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && parsed.practitionerCode) {
                        window.practitioner = parsed;
                        updatePractitionerInterface();
                        console.log('Loaded practitioner from cache');
                        return window.practitioner;
                    }
                }
            } catch (e) {
                console.warn('Could not load from cache:', e);
            }
            
            // Show error but don't block
            updatePractitionerInterface();
            return null;
        }
    }
    
    // Create practitioner in Firestore
    async function createPractitionerInFirestore(uid) {
        try {
            console.log('Creating practitioner in Firestore for UID:', uid);
            
            const auth = firebase.auth();
            const user = auth.currentUser;
            
            if (!user) {
                console.error('No authenticated user');
                return null;
            }
            
            const practitionerCode = generatePractitionerCode();
            
            const practitionerData = {
                uid: uid,
                email: user.email || '',
                firstName: user.displayName ? user.displayName.split(' ')[0] : '',
                lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
                practitionerCode: practitionerCode,
                profileImage: user.photoURL || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const db = firebase.firestore();
            await db.collection('practitioners').doc(uid).set(practitionerData);
            
            window.practitioner = practitionerData;
            
            // Update local storage
            try {
                localStorage.setItem('practitioner', JSON.stringify(window.practitioner));
            } catch (e) {
                console.warn('Could not save to localStorage:', e);
            }
            
            // Update interface
            updatePractitionerInterface();
            
            console.log('Practitioner created with code:', practitionerCode);
            return window.practitioner;
        } catch (error) {
            console.error('Error creating practitioner:', error);
            return null;
        }
    }
    
    // Update practitioner interface - FIXED
    function updatePractitionerInterface() {
        try {
            console.log('Updating practitioner interface, practitioner:', window.practitioner);
            
            // Find the code display element
            const codeElement = document.getElementById('practitioner-code-display') || 
                               document.querySelector('[id*="code"]') ||
                               document.querySelector('input[placeholder*="code" i]') ||
                               document.querySelector('.practitioner-code');
            
            if (!codeElement) {
                console.warn('Could not find code display element');
                // Try to find by text content
                const allInputs = document.querySelectorAll('input, div, span');
                for (let el of allInputs) {
                    if (el.textContent && el.textContent.includes('Loading...')) {
                        codeElement = el;
                        break;
                    }
                }
            }
            
            if (codeElement) {
                if (window.practitioner && window.practitioner.practitionerCode) {
                    // Set the code value
                    if (codeElement.tagName === 'INPUT') {
                        codeElement.value = window.practitioner.practitionerCode;
                    } else {
                        codeElement.textContent = window.practitioner.practitionerCode;
                    }
                    
                    // Remove loading state
                    codeElement.classList.remove('loading');
                    codeElement.style.color = '';
                    
                    console.log('Code displayed:', window.practitioner.practitionerCode);
                } else {
                    // Still loading or no code
                    if (codeElement.tagName === 'INPUT') {
                        codeElement.value = 'Generating...';
                    } else {
                        codeElement.textContent = 'Generating...';
                    }
                }
            } else {
                console.error('Code element not found in DOM');
            }
            
            // Update profile image if available
            if (window.practitioner && window.practitioner.profileImage) {
                const profileImg = document.querySelector('.profile-image, [class*="profile"] img, .user-avatar');
                if (profileImg) {
                    profileImg.src = window.practitioner.profileImage;
                }
            }
        } catch (error) {
            console.error('Error updating practitioner interface:', error);
        }
    }
    
    // Initialize practitioner - SIMPLIFIED
    async function initializePractitioner() {
        if (isInitializing || isInitialized) {
            console.log('Already initializing or initialized');
            return;
        }
        
        isInitializing = true;
        console.log('Initializing practitioner...');
        
        try {
            const auth = firebase.auth();
            
            // Wait for auth with timeout
            const authPromise = new Promise((resolve, reject) => {
                const unsubscribe = auth.onAuthStateChanged((user) => {
                    unsubscribe();
                    resolve(user);
                });
                
                setTimeout(() => {
                    unsubscribe();
                    reject(new Error('Auth timeout'));
                }, 10000);
            });
            
            const user = await authPromise;
            
            if (!user) {
                console.warn('No authenticated user');
                isInitializing = false;
                return;
            }
            
            console.log('User authenticated:', user.uid);
            
            // Load practitioner data
            await loadPractitionerFromFirestore(user.uid);
            
            isInitialized = true;
            isInitializing = false;
            
            console.log('Practitioner initialization complete');
        } catch (error) {
            console.error('Error initializing practitioner:', error);
            isInitializing = false;
            
            // Still try to update interface
            updatePractitionerInterface();
        }
    }
    
    // Initialize when DOM is ready and Firebase is loaded
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                // Wait for Firebase to be available
                if (typeof firebase !== 'undefined' && firebase.auth) {
                    setTimeout(initializePractitioner, 500);
                } else {
                    // Wait for Firebase
                    const checkFirebase = setInterval(function() {
                        if (typeof firebase !== 'undefined' && firebase.auth) {
                            clearInterval(checkFirebase);
                            setTimeout(initializePractitioner, 500);
                        }
                    }, 100);
                    
                    // Timeout after 10 seconds
                    setTimeout(function() {
                        clearInterval(checkFirebase);
                        console.warn('Firebase not loaded, trying anyway...');
                        initializePractitioner();
                    }, 10000);
                }
            });
        } else {
            // DOM already ready
            if (typeof firebase !== 'undefined' && firebase.auth) {
                setTimeout(initializePractitioner, 500);
            } else {
                const checkFirebase = setInterval(function() {
                    if (typeof firebase !== 'undefined' && firebase.auth) {
                        clearInterval(checkFirebase);
                        setTimeout(initializePractitioner, 500);
                    }
                }, 100);
                
                setTimeout(function() {
                    clearInterval(checkFirebase);
                    initializePractitioner();
                }, 10000);
            }
        }
    }
    
    // Expose functions globally
    window.initializePractitioner = initializePractitioner;
    window.updatePractitionerInterface = updatePractitionerInterface;
    window.loadPractitionerFromFirestore = loadPractitionerFromFirestore;
    
    // Start initialization
    init();
    
    // Also try on window load as backup
    window.addEventListener('load', function() {
        if (!isInitialized && !isInitializing) {
            setTimeout(initializePractitioner, 1000);
        }
    });
})();



