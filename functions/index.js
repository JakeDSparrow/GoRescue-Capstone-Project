/**
 * Import function triggers from their respective sub-modules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// Initialize the Firebase Admin SDK
admin.initializeApp();

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
