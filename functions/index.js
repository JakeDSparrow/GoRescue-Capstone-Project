/**
 * Import function triggers from their respective sub-modules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest, onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// Initialize the Firebase Admin SDK
admin.initializeApp();

// Your existing addUser function
exports.addUser = onRequest((request, response) => {
  // Check if the request is a POST request
  if (request.method !== "POST") {
    response.status(405).send("Method Not Allowed");
    return;
  }

  // Get the user data from the request body
  const {email, password} = request.body;

  // Validate the input
  if (!email || !password) {
    response.status(400).send("Email and password are required.");
    return;
  }

  // Create a new user with the provided email and password
  admin.auth().createUser({
    email: email,
    password: password,
  })
      .then((userRecord) => {
        // The user was created successfully
        logger.info(`Successfully created new user: ${userRecord.uid}`);
        response.status(201).send(`User created with UID: ${userRecord.uid}`);
      })
      .catch((error) => {
        // Handle the error
        logger.error("Error creating new user:", error);
        response.status(500).send(`Error creating user: ${error.message}`);
      });
});

// NEW: Push notification function for incidents
exports.sendIncidentNotification = onCall({cors: true}, async (request) => {
  // Verify the user is authenticated
  if (!request.auth) {
    throw new Error("User must be authenticated");
  }

  const {
    incidentCode,
    emergencyType,
    emergencySeverity,
    location,
    teamData,
    coordinates,
  } = request.data;

  try {
    // Get FCM tokens for the responding team members
    const teamMemberIds = teamData.members.map((member) => member.uid);
    const fcmTokens = [];

    // Fetch FCM tokens from user documents
    for (const uid of teamMemberIds) {
      try {
        const userDoc = await admin.firestore().collection("users")
            .doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData.fcmToken) {
            fcmTokens.push(userData.fcmToken);
          }
        }
      } catch (error) {
        logger.error(`Error fetching user ${uid}:`, error);
        // Continue with other users
      }
    }

    if (fcmTokens.length === 0) {
      logger.info("No FCM tokens found for team members");
      return {success: true, message: "No devices to notify"};
    }

    // Create the notification payload
    const payload = {
      notification: {
        title: `🚨 New ${emergencyType.toUpperCase()} Emergency`,
        body: `Incident: ${incidentCode} | Severity: ` +
        `${emergencySeverity.toUpperCase()} | Location: ${location}`,
      },
      data: {
        incidentCode: incidentCode,
        emergencyType: emergencyType,
        emergencySeverity: emergencySeverity,
        location: location,
        latitude: coordinates.lat.toString(),
        longitude: coordinates.lng.toString(),
        teamName: teamData.teamName,
        action: "new_incident",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "emergency_channel",
          priority: "max",
          sound: "default",
          vibrate: [1000, 1000, 1000],
          icon: "ic_notification",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    // Send multicast message
    const response = await admin.messaging().sendMulticast({
      tokens: fcmTokens,
      ...payload,
    });

    logger.info(`Successfully sent message to ` +
    `${response.successCount} devices`);

    if (response.failureCount > 0) {
      logger.warn(`Failed to send to ` +
      `${response.failureCount} devices`);
      // Handle failed tokens (remove invalid ones from database)
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          logger.error("Error sending to token:", resp.error);
          // If token is invalid, mark it for cleanup
          if (
            resp.error?.code === "messaging/registration-token-not-registered"||
            resp.error?.code === "messaging/invalid-registration-token"
          ) {
            failedTokens.push(fcmTokens[idx]);
          }
        }
      });

      // Remove invalid tokens from user documents
      if (failedTokens.length > 0) {
        await cleanupInvalidTokens(failedTokens, teamMemberIds);
      }
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    logger.error("Error sending notification:", error);
    throw new Error("Failed to send notification: " + error.message);
  }
});

/**
 * Removes invalid FCM tokens from user documents.
 * @param {string[]} failedTokens - An array of invalid FCM tokens.
 * @param {string[]} userIds - An array of user UIDs.
 */
async function cleanupInvalidTokens(failedTokens, userIds) {
  const promises = [];

  for (const token of failedTokens) {
    for (const uid of userIds) {
      promises.push(
          admin.firestore().collection("users").doc(uid).get()
              .then((userDoc) => {
                if (userDoc.exists && userDoc.data().fcmToken === token) {
                  return admin.firestore().collection("users").doc(uid).update({
                    fcmToken: admin.firestore.FieldValue.delete(),
                  });
                }
                return null;
              })
              .then(() => {
                logger.info(`Removed invalid token for user ${uid}`);
              })
              .catch((error) => {
                logger.error(`Error cleaning up token for user ${uid}:`, error);
              }),
      );
    }
  }

  await Promise.all(promises);
}
