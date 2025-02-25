// import {onRequest, onCall} from 'firebase-functions/v2/https';
// import * as logger from 'firebase-functions/logger';
import functions from 'firebase-functions';
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import type {Response, NextFunction} from 'express';
import type {AuthenticatedRequest} from './types';

if (!admin.app.length) {
  // Initialize Firebase Admin SDK
  admin.initializeApp();
}

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
const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    res.status(401).send('Unauthorized: No token provided');
    return;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).send('Unauthorized: Invalid token');
  }
};

// Protected route (requires authentication)
app.get(
  '/protected',
  authenticate,
  (req: AuthenticatedRequest, res: Response) => {
    res.send(
      `Hello ${req.user?.uid ?? ''}, you have accessed a protected endpoint!`,
    );
  },
);

const api = functions.https.onRequest(app);

export default api;
