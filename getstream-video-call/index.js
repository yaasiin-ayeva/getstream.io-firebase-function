import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { StreamClient } from "@stream-io/node-sdk";
import { logger } from "firebase-functions";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();
if (admin.apps.length === 0) admin.initializeApp();

const apiKey = process.env.STREAM_API_KEY || "";
const apiSecret = process.env.STREAM_API_SECRET || "";

if (!apiKey || !apiSecret) throw new Error("Missing Stream API key/secret");

const streamClient = new StreamClient(apiKey, apiSecret);

/**
 * Generate a Stream token for the authenticated user
 * @param {Object} request - The request object
 * @param {Object} request.auth - The auth object
 * @returns {Object} The result object
 * @returns {string} The result.token - The Stream token
 */
export const generateStreamToken = onCall(async (request) => {
    logger.info("generateStreamToken function called");
    const context = request.auth;

    // Check if user is authenticated
    if (!context) {
        throw new HttpsError(
            "unauthenticated",
            "User must be authenticated to generate a Stream token."
        );
    }

    const userId = context.uid;

    try {
        const token = streamClient.generateCallToken(userId);
        logger.info(`Stream token generated for user: ${userId}`);

        return {
            token: token,
            expiresAt: Date.now() + (24 * 60 * 60 * 1000),
            generated: new Date().toISOString()
        };

    } catch (error) {
        logger.error("Error generating Stream token:", error);
        throw new HttpsError(
            "internal",
            "Unable to generate Stream token.",
            error
        );
    }
});

/**
 * Create a new user in Firestore
 * @param {Object} request - The request object
 * @param {Object} request.data - The user object
 * @param {string} request.data.uid - The user ID
 * @param {string} request.data.displayName - The user's display name
 * @param {string} request.data.email - The user's email address
 * @param {string} [request.data.photoURL] - Optional user photo URL
 * @returns {Object} The result object
 * @returns {string} The result.result - The result message
 */
export const createUser = onCall(async (request) => {
    logger.info("createUser function called");
    const user = request.data;
    logger.info("createUser function called with user:", user);

    if (!user.uid || typeof user.uid !== "string" || user.uid.trim() === "") {
        throw new HttpsError(
            "invalid-argument",
            "The function must be called with a valid uid."
        );
    }

    if (!user.displayName || typeof user.displayName !== "string" || user.displayName.trim() === "") {
        throw new HttpsError(
            "invalid-argument",
            "The function must be called with a valid displayName."
        );
    }

    if (!user.email || typeof user.email !== "string" || !user.email.includes("@")) {
        throw new HttpsError(
            "invalid-argument",
            "The function must be called with a valid email."
        );
    }

    try {
        const db = admin.firestore();

        const userDoc = await db.collection("users_").doc(user.uid).get();
        if (userDoc.exists) {
            logger.info(`User with UID ${user.uid} already exists, updating profile`);
            await db.collection("users_").doc(user.uid).update({
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL || null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return {
                result: `User with UID ${user.uid} updated successfully.`,
                updated: true
            };
        }

        await db.collection("users_").doc(user.uid).set({
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        try {
            await streamClient.user.create({
                id: user.uid,
                name: user.displayName,
                image: user.photoURL
            });
            logger.info(`Stream user created for UID ${user.uid}`);
        } catch (streamError) {
            logger.warn(`Failed to create Stream user: ${streamError.message}`, streamError);
        }

        logger.info("createUser function finished successfully");
        return {
            result: `User with UID ${user.uid} created successfully.`,
            created: true
        };
    } catch (error) {
        logger.error("Error creating user:", error);
        throw new HttpsError(
            "internal",
            "Failed to create user.",
            error
        );
    }
});

/**
 * Fetches the profile data for a user
 * @param {Object} request - The request object
 * @param {Object} request.auth - The auth object
 * @param {Object} request.data - The data object
 * @param {string} [request.data.userId] - Optional user ID to fetch (admin only)
 * @returns {Object} User data
 */
export const getUserProfile = onCall(async (request) => {
    const auth = request.auth;

    if (!auth) {
        throw new HttpsError(
            "unauthenticated",
            "User must be authenticated to access profiles."
        );
    }

    let userId = auth.uid;

    if (request.data?.userId && request.data.userId !== auth.uid) {
        try {
            const db = admin.firestore();
            const userDoc = await db.collection("users_").doc(auth.uid).get();
            const userData = userDoc.data();

            if (!userData || userData.role !== "admin") {
                throw new HttpsError(
                    "permission-denied",
                    "Only admins can access other user profiles."
                );
            }

            userId = request.data.userId;
        } catch (error) {
            logger.error("Error checking admin permissions:", error);
            throw new HttpsError(
                "permission-denied",
                "Failed to verify permissions."
            );
        }
    }

    try {
        const db = admin.firestore();
        const userDoc = await db.collection("users_").doc(userId).get();

        if (!userDoc.exists) {
            throw new HttpsError(
                "not-found",
                `User with ID ${userId} not found.`
            );
        }

        const userData = userDoc.data();
        return {
            uid: userId,
            displayName: userData.displayName,
            email: userData.email,
            photoURL: userData.photoURL,
            createdAt: userData.createdAt?.toDate?.() || null,
        };
    } catch (error) {
        logger.error("Error fetching user profile:", error);
        throw new HttpsError(
            "internal",
            "Failed to fetch user profile.",
            error
        );
    }
});

/**
 * Creates a video session with the provided participants and returns the session ID (NOT FULLY IMPLEMENTED)
 * @param {Object} request - The request object
 * @param {Object} request.auth - The auth object
 * @param {Object} request.data - The data object
 * @param {string[]} request.data.participants - Array of participant user IDs
 * @returns {Object} Session details
 */
export const createVideoSession = onCall(async (request) => {
    const auth = request.auth;

    if (!auth) {
        throw new HttpsError(
            "unauthenticated",
            "User must be authenticated to create video sessions."
        );
    }

    const { participants } = request.data || {};

    if (!participants || !Array.isArray(participants) || participants.length < 1) {
        throw new HttpsError(
            "invalid-argument",
            "Must provide an array of participant user IDs."
        );
    }

    if (!participants.includes(auth.uid)) {
        participants.push(auth.uid);
    }

    try {
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        logger.info(`Creating video session: ${sessionId} with participants: ${participants.join(', ')}`);

        const db = admin.firestore();
        await db.collection("videoSessions").doc(sessionId).set({
            createdBy: auth.uid,
            participants: participants,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "active"
        });

        return {
            sessionId: sessionId,
            createdAt: new Date().toISOString(),
            participants: participants
        };
    } catch (error) {
        logger.error("Error creating video session:", error);
        throw new HttpsError(
            "internal",
            "Failed to create video session.",
            error
        );
    }
});