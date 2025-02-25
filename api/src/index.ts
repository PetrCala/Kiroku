// import {onRequest, onCall} from 'firebase-functions/v2/https';
// import * as logger from 'firebase-functions/logger';
import functions from 'firebase-functions';
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';

// Initialize Firebase Admin SDK
admin.initializeApp();

const app = express();

// Enable CORS (Cross-Origin Resource Sharing)
app.use(cors({origin: true}));

// Parse incoming JSON requests
app.use(express.json());

// Public route (accessible without authentication)
app.get('/public', (req, res) => {
  res.send('Hello from the public endpoint!');
});

// app.use(myMiddleware);

// Authentication middleware
const authenticate = async (req, res, next) => {
  const idToken = req.headers.authorization?.split('Bearer ')[1];

  if (!idToken) {
    return res.status(401).send('Unauthorized: No token provided');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).send('Unauthorized: Invalid token');
  }
};

// Protected route (requires authentication)
app.get('/protected', authenticate, (req, res) => {
  res.send(`Hello ${req.user.uid}, you have accessed a protected endpoint!`);
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
