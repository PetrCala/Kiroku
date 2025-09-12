import {onRequest} from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import express = require('express');
import cors = require('cors');
import type {Response, NextFunction} from 'express';
import type {AuthenticatedRequest} from './types';
import {DBPATHS} from '@kiroku/common';

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
    logger.error('Authentication error:', error);
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

// Friends routes
app.post(
  '/friends/request',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const fromUserId = req.user?.uid;
      const {toUserId} = req.body ?? {};
      if (!fromUserId || !toUserId || typeof toUserId !== 'string') {
        res.status(400).json({error: 'Invalid payload'});
        return;
      }
      if (fromUserId === toUserId) {
        res.status(400).json({error: 'Cannot send request to self'});
        return;
      }
      const updates: Record<string, string> = {};
      updates[
        DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID.getRoute(
          fromUserId,
          toUserId,
        )
      ] = 'sent';
      updates[
        DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID.getRoute(
          toUserId,
          fromUserId,
        )
      ] = 'received';
      await admin.database().ref().update(updates);
      res.json({ok: true});
    } catch (e) {
      logger.error('friends/request error', e);
      res.status(500).json({error: 'Internal error'});
    }
  },
);

app.post(
  '/friends/delete-request',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const currentUserId = req.user?.uid;
      const {otherUserId} = req.body ?? {};
      if (!currentUserId || !otherUserId || typeof otherUserId !== 'string') {
        res.status(400).json({error: 'Invalid payload'});
        return;
      }
      const updates: Record<string, null> = {};
      updates[
        DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID.getRoute(
          currentUserId,
          otherUserId,
        )
      ] = null;
      updates[
        DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID.getRoute(
          otherUserId,
          currentUserId,
        )
      ] = null;
      await admin.database().ref().update(updates);
      res.json({ok: true});
    } catch (e) {
      logger.error('friends/delete-request error', e);
      res.status(500).json({error: 'Internal error'});
    }
  },
);

app.post(
  '/friends/accept',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const currentUserId = req.user?.uid;
      const {fromUserId} = req.body ?? {};
      if (!currentUserId || !fromUserId || typeof fromUserId !== 'string') {
        res.status(400).json({error: 'Invalid payload'});
        return;
      }
      const updates: Record<string, boolean | null> = {};
      updates[
        DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID.getRoute(
          currentUserId,
          fromUserId,
        )
      ] = null;
      updates[
        DBPATHS.USERS_USER_ID_FRIEND_REQUESTS_REQUEST_ID.getRoute(
          fromUserId,
          currentUserId,
        )
      ] = null;
      updates[
        DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID.getRoute(
          currentUserId,
          fromUserId,
        )
      ] = true;
      updates[
        DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID.getRoute(
          fromUserId,
          currentUserId,
        )
      ] = true;
      await admin.database().ref().update(updates);
      res.json({ok: true});
    } catch (e) {
      logger.error('friends/accept error', e);
      res.status(500).json({error: 'Internal error'});
    }
  },
);

app.post(
  '/friends/remove',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const currentUserId = req.user?.uid;
      const {otherUserId} = req.body ?? {};
      if (!currentUserId || !otherUserId || typeof otherUserId !== 'string') {
        res.status(400).json({error: 'Invalid payload'});
        return;
      }
      const updates: Record<string, null> = {};
      updates[
        DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID.getRoute(
          currentUserId,
          otherUserId,
        )
      ] = null;
      updates[
        DBPATHS.USERS_USER_ID_FRIENDS_FRIEND_ID.getRoute(
          otherUserId,
          currentUserId,
        )
      ] = null;
      await admin.database().ref().update(updates);
      res.json({ok: true});
    } catch (e) {
      logger.error('friends/remove error', e);
      res.status(500).json({error: 'Internal error'});
    }
  },
);

const FUNCTIONS_REGION = process.env.FUNCTIONS_REGION || 'us-central1';
// eslint-disable-next-line
export const api = onRequest(
  {
    region: FUNCTIONS_REGION,
  },
  app,
);
