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

// Enhanced addUser function with complete user data and email sending
exports.addUser = onCall({cors: true}, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.',
        );
    }

    const userData = request.data;
    const {email, fullName, role, phone, birthdate, age, address, gender} = userData;

    if (!email || !fullName || !role) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Email, full name, and role are required.',
        );
    }

    try {
        // Generate a temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
        
        // Create Firebase Auth user
        const userRecord = await admin.auth().createUser({
            email: email,
            password: tempPassword,
            emailVerified: false,
            disabled: false,
        });

        logger.info(`Successfully created Firebase Auth user: ${userRecord.uid}`);

        // Create user document in Firestore
        const db = admin.firestore();
        const userDoc = {
            uid: userRecord.uid,
            email: email,
            fullName: fullName,
            role: role.toLowerCase(),
            phone: phone || '',
            birthdate: birthdate || '',
            age: age || 0,
            address: address || '',
            gender: gender || '',
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            needsPasswordSetup: true,
            tempPassword: tempPassword, // Store temporarily for email
        };

        await db.collection('mdrrmo-users').doc(userRecord.uid).set(userDoc);
        logger.info(`Successfully created user document for: ${userRecord.uid}`);

        // Send password setup email
        try {
            await sendPasswordSetupEmail(email, fullName, tempPassword);
            logger.info(`Password setup email sent to: ${email}`);
        } catch (emailError) {
            logger.error('Failed to send password setup email:', emailError);
            // Don't fail the user creation if email fails
        }

        // Clean up temp password from document
        await db.collection('mdrrmo-users').doc(userRecord.uid).update({
            tempPassword: admin.firestore.FieldValue.delete()
        });

        return {
            success: true,
            uid: userRecord.uid,
            message: 'User created successfully and password setup email sent.',
        };

    } catch (error) {
        logger.error('Error creating user:', error);
        throw new functions.https.HttpsError(
            'internal',
            `Error creating user: ${error.message}`,
        );
    }
});

// Helper function to send password setup email
async function sendPasswordSetupEmail(email, fullName, tempPassword) {
    const nodemailer = require('nodemailer');
    
    // Create transporter (you'll need to configure this with your email service)
    const transporter = nodemailer.createTransporter({
        service: 'gmail', // or your email service
        auth: {
            user: process.env.EMAIL_USER, // Set these in Firebase Functions config
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'GoRescue - Complete Your Account Setup',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #6c8c44;">Welcome to GoRescue, ${fullName}!</h2>
                <p>Your account has been created successfully. Please use the temporary password below to log in and set up your account:</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">Your Login Credentials:</h3>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #fff; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${tempPassword}</code></p>
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Important Security Notice</h4>
                    <p style="margin: 0; color: #856404;">Please change your password immediately after your first login for security purposes.</p>
                </div>
                
                <p>You can access the GoRescue portal at: <a href="${process.env.APP_URL || 'https://your-app-url.com'}">GoRescue Portal</a></p>
                
                <p>If you have any questions, please contact your administrator.</p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #666;">This is an automated message from GoRescue Emergency Management System.</p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
}

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