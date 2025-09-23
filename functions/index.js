/**
 * Import function triggers from their respective sub-modules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
const functions = require('firebase-functions');
const {onRequest, onCall} = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

// Initialize the Firebase Admin SDK
admin.initializeApp();

// Your existing addUser function
exports.addUser = onRequest((request, response) => {
    if (request.method !== 'POST') {
        response.status(405).send('Method Not Allowed');
        return;
    }

    const {email, password} = request.body;
    if (!email || !password) {
        response.status(400).send('Email and password are required.');
        return;
    }

    admin.auth().createUser({
        email: email,
        password: password,
    })
        .then((userRecord) => {
            logger.info(`Successfully created new user: ${userRecord.uid}`);
            response.status(201).send(`User created with UID: ${userRecord.uid}`);
        })
        .catch((error) => {
            logger.error('Error creating new user:', error);
            response.status(500).send(`Error creating user: ${error.message}`);
        });
});

// FIXED: Push notification function for incidents
// FIXED: Push notification function for incidents with detailed debugging
exports.sendIncidentNotification = onCall({cors: true}, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.',
        );
    }

    const {
        incidentCode,
        emergencyType,
        emergencySeverity,
        location,
        teamData,
    } = request.data;

    logger.info('=== DEBUGGING NOTIFICATION FUNCTION ===');
    logger.info('Received teamData:', JSON.stringify(teamData, null, 2));

    // Handle both formats: direct array or object with members property
    let teamMembers = [];
    if (Array.isArray(teamData)) {
        teamMembers = teamData;
    } else if (teamData && Array.isArray(teamData.members)) {
        teamMembers = teamData.members;
    } else {
        logger.error('Invalid teamData format:', teamData);
        throw new functions.https.HttpsError(
            'invalid-argument',
            'teamData must be an array or object with members array.',
        );
    }

    if (teamMembers.length === 0) {
        logger.error('No team members found in teamData.');
        throw new functions.https.HttpsError(
            'invalid-argument',
            'No team members found to notify.',
        );
    }

    logger.info(`Processing ${teamMembers.length} team members:`, teamMembers);

    try {
        const teamMemberUids = teamMembers.map((member) => member.uid).filter(uid => uid);
        logger.info(`Found ${teamMemberUids.length} valid UIDs:`, teamMemberUids);
        
        const tokens = [];
        const db = admin.firestore();

        // Debug each user lookup
        for (const uid of teamMemberUids) {
            try {
                logger.info(`Looking up user document: mdrrmo-users/${uid}`);
                const userDoc = await db.collection('mdrrmo-users').doc(uid).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    logger.info(`User ${uid} document exists. Data:`, {
                        hasData: !!userData,
                        keys: userData ? Object.keys(userData) : [],
                        fcmToken: userData?.fcmToken ? 'EXISTS' : 'MISSING',
                        tokenPreview: userData?.fcmToken ? userData.fcmToken.substring(0, 20) + '...' : 'N/A'
                    });
                    
                    if (userData && userData.fcmToken) {
                        tokens.push(userData.fcmToken);
                        logger.info(`✅ Added FCM token for user: ${uid}`);
                    } else {
                        logger.warn(`❌ No FCM token found for user: ${uid}`);
                        // Check for alternative token field names
                        const alternativeFields = ['token', 'pushToken', 'deviceToken', 'notificationToken'];
                        for (const field of alternativeFields) {
                            if (userData && userData[field]) {
                                logger.info(`Found alternative token field '${field}' for user ${uid}`);
                                tokens.push(userData[field]);
                                break;
                            }
                        }
                    }
                } else {
                    logger.error(`❌ User document does not exist: mdrrmo-users/${uid}`);
                }
            } catch (error) {
                logger.error(`❌ Error fetching user document for ${uid}:`, error);
            }
        }

        logger.info(`=== TOKEN COLLECTION SUMMARY ===`);
        logger.info(`Total tokens found: ${tokens.length}`);
        logger.info(`Tokens preview:`, tokens.map(token => token.substring(0, 20) + '...'));

        if (tokens.length === 0) {
            // Let's also check what users exist in the collection
            try {
                const allUsersSnapshot = await db.collection('mdrrmo-users').limit(5).get();
                logger.info('Sample users in mdrrmo-users collection:');
                allUsersSnapshot.forEach(doc => {
                    const data = doc.data();
                    logger.info(`User ${doc.id}:`, {
                        keys: Object.keys(data),
                        role: data.role,
                        hasFcmToken: !!data.fcmToken
                    });
                });
            } catch (e) {
                logger.error('Could not fetch sample users:', e);
            }
            
            logger.warn('No valid FCM tokens found for any team members.');
            return {success: true, message: 'No devices to notify.'};
        }

        // Create notification payload
        const title = `New Incident: ${incidentCode || 'Emergency'}`;
        const body = `${emergencyType || 'Emergency'} - ${emergencySeverity || 'Unknown'} severity\nLocation: ${location || 'Not specified'}`;

        const payload = {
            notification: {
                title: title,
                body: body,
            },
            data: {
                incidentCode: incidentCode || 'N/A',
                emergencyType: emergencyType || 'Unknown Type',
                emergencySeverity: emergencySeverity || 'Unknown',
                location: location || 'Not specified',
            },
            android: {
                priority: 'high',
                notification: {
                    priority: 'high',
                    defaultSound: true,
                    defaultVibrateTimings: true,
                },
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: title,
                            body: body,
                        },
                        sound: 'default',
                        'content-available': 1,
                    },
                },
            },
        };

        logger.info(`Attempting to send notification to ${tokens.length} tokens.`);
        logger.info('Notification payload:', JSON.stringify(payload, null, 2));

        const response = await admin.messaging().sendEachForMulticast({
            tokens: tokens,
            ...payload,
        });

        logger.info(`Successfully sent message to ${response.successCount} devices.`);
        if (response.failureCount > 0) {
            logger.warn(`Failed to send to ${response.failureCount} devices.`);
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    logger.error(`Failed to send to token ${idx}:`, resp.error);
                }
            });
        }

        return {
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount,
            message: `Notification sent to ${response.successCount} devices.`,
        };
    } catch (error) {
        logger.error('Error sending notification:', error);
        throw new functions.https.HttpsError(
            'internal',
            'An unexpected error occurred while sending the notification.',
        );
    }
});