/**
 * Import function triggers from their respective sub-modules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
const functions = require('firebase-functions');
const {onCall} = require('firebase-functions/v2/https');
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
    const {email, fullName, role, phone, birthdate, age, address, gender, fcmToken} = userData;

    if (!email || !fullName || !role) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Email, full name, and role are required.',
        );
    }

    try {
        // Generate a strong temporary password (not shared with user)
        const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + Math.floor(Math.random() * 1000);
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
            fcmToken: '', // Empty field for future FCM implementation
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            needsPasswordSetup: true,
        };

        await db.collection('mdrrmo-users').doc(userRecord.uid).set(userDoc);
        logger.info(`Successfully created user document for: ${userRecord.uid}`);

        // Generate password reset link and send email
        try {
            const actionCodeSettings = {
                url: 'http://localhost:3000/login', // Use localhost for development
                handleCodeInApp: false,
            };
            const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
            await sendPasswordSetupEmail(email, fullName, resetLink);
            logger.info(`Password reset link sent to: ${email}`);
        } catch (emailError) {
            logger.error('Failed to send password reset link:', emailError);
            // Don't fail the user creation if email fails
        }

        return {
            success: true,
            uid: userRecord.uid,
            message: 'User created successfully and password reset link sent.',
        };
    } catch (error) {
        logger.error('Error creating user:', error);
        throw new functions.https.HttpsError(
            'internal',
            `Error creating user: ${error.message}`,
        );
    }
});

/**
 * Helper function to send password setup email (via password reset link)
 * @param {string} email - User's email address
 * @param {string} fullName - User's full name
 * @param {string} resetLink - Password reset link
 * @return {Promise} Email sending result
 */
async function sendPasswordSetupEmail(email, fullName, resetLink) {
    const nodemailer = require('nodemailer');

    // Try multiple email configurations for better reliability
    let transporter;

    try {
        // First try: Gmail with app password
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });
        } 
        // Second try: SendGrid (more reliable)
        else if (process.env.SENDGRID_API_KEY) {
            transporter = nodemailer.createTransport({
                service: 'SendGrid',
                auth: {
                    user: 'apikey',
                    pass: process.env.SENDGRID_API_KEY,
                },
            });
        }
        // Fallback: Use a generic SMTP (you can configure this)
        else {
            transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER || 'your-email@gmail.com',
                    pass: process.env.EMAIL_PASS || 'your-app-password',
                },
            });
        }
    } catch (error) {
        logger.error('Error creating email transporter:', error);
        throw new Error('Email service not configured properly');
    }

    const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@gorescue.com',
        to: email,
        subject: 'GoRescue - Complete Your Account Setup',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #6c8c44;">Welcome to GoRescue, ${fullName}!</h2>
                <p>Your account has been created successfully. To set your password securely, click the button below:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background: #6c8c44; color: #fff; text-decoration: none; padding: 15px 30px; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">Set Your Password</a>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">Your Account Details:</h3>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Active</p>
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Important Security Notice</h4>
                    <p style="margin: 0; color: #856404;">This link allows you to set a secure password for your account. If you did not request this, please contact your administrator immediately.</p>
                </div>
                
                <p>You can access the GoRescue portal at: <a href="${process.env.APP_URL || 'https://your-app-url.com'}">GoRescue Portal</a></p>
                
                <p>If you have any questions, please contact your administrator.</p>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #666;">This is an automated message from GoRescue Emergency Management System.</p>
            </div>
        `,
    };

    try {
        const result = await transporter.sendMail(mailOptions);
        logger.info(`Email sent successfully to ${email}:`, result.messageId);
        return result;
    } catch (error) {
        logger.error(`Failed to send email to ${email}:`, error);
        throw error;
    }
}

// Test email function for debugging
exports.testEmail = onCall({cors: true}, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.',
        );
    }

    const { email, fullName } = request.data;
    
    if (!email) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Email is required for testing.',
        );
    }

    try {
        // Generate a test reset link
        const actionCodeSettings = {
            url: process.env.APP_URL || 'https://your-app-url.com/login',
            handleCodeInApp: false,
        };
        const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
        
        // Send test email
        await sendPasswordSetupEmail(email, fullName || 'Test User', resetLink);
        
        return {
            success: true,
            message: `Test email sent to ${email}`,
            resetLink: resetLink // For debugging
        };
    } catch (error) {
        logger.error('Test email failed:', error);
        return {
            success: false,
            error: error.message,
            message: 'Test email failed. Check logs for details.'
        };
    }
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