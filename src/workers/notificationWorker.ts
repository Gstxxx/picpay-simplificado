import prisma from '../lib/prisma.js';
import { fetchWithResilience } from '../lib/http.js';

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 5;
const NOTIFY_URL = process.env.NOTIFY_URL || 'https:

async function processPendingNotifications() {
  try {
    const pending = await prisma.notificationOutbox.findMany({
      where: {
        status: 'PENDING',
        attempts: { lt: MAX_ATTEMPTS },
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    for (const notification of pending) {
      try {
        const response = await fetchWithResilience(NOTIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: notification.email,
            message: notification.message,
          }),
          timeoutMs: 3000,
          retries: 2,
          retryDelayBaseMs: 300,
        });

        if (response.ok) {
          await prisma.notificationOutbox.update({
            where: { id: notification.id },
            data: { status: 'SENT', updatedAt: new Date() },
          });
          console.log(`Notification sent: ${notification.id}`);
        } else {
          await prisma.notificationOutbox.update({
            where: { id: notification.id },
            data: {
              attempts: { increment: 1 },
              lastError: `HTTP ${response.status}`,
              status: notification.attempts + 1 >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
              updatedAt: new Date(),
            },
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await prisma.notificationOutbox.update({
          where: { id: notification.id },
          data: {
            attempts: { increment: 1 },
            lastError: errorMsg,
            status: notification.attempts + 1 >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
            updatedAt: new Date(),
          },
        });
        console.error(`Notification failed: ${notification.id}, error: ${errorMsg}`);
      }
    }
  } catch (err) {
    console.error('Notification worker error:', err);
  }
}

let workerInterval: NodeJS.Timeout | null = null;

export function startNotificationWorker() {
  if (workerInterval) return;
  console.log('Starting notification worker...');
  workerInterval = setInterval(processPendingNotifications, POLL_INTERVAL_MS);
  processPendingNotifications(); 
}

export function stopNotificationWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('Notification worker stopped.');
  }
}

