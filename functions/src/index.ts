import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { CloudTasksClient } from "@google-cloud/tasks";

admin.initializeApp();

const REGION = process.env.FUNCTION_REGION || "europe-west4";
setGlobalOptions({ region: REGION });
const TASKS_LOCATION = process.env.CLOUD_TASKS_LOCATION || "europe-west1";
const TASKS_QUEUE = process.env.CLOUD_TASKS_QUEUE || "rest-notifications";
const TASKS_SECRET = process.env.CLOUD_TASKS_SECRET || "";
const TASKS_SERVICE_ACCOUNT = process.env.CLOUD_TASKS_SERVICE_ACCOUNT || "";

const tasksClient = new CloudTasksClient();

const getProjectId = () =>
  admin.app().options.projectId || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";

const buildTaskId = ({ uid, exerciseId, timerEndsAt }: {
  uid: string;
  exerciseId: string;
  timerEndsAt: number;
}) =>
  `rest-${uid}-${exerciseId}-${timerEndsAt}`.replace(/[^a-zA-Z0-9-]/g, "-");

const getTaskName = (taskId: string) => {
  const projectId = getProjectId();
  if (!projectId) return "";
  return tasksClient.taskPath(projectId, TASKS_LOCATION, TASKS_QUEUE, taskId);
};

const getTaskParent = () => {
  const projectId = getProjectId();
  if (!projectId) return "";
  return tasksClient.queuePath(projectId, TASKS_LOCATION, TASKS_QUEUE);
};

const cancelTaskIfExists = async (taskName?: string | null) => {
  if (!taskName) return;
  try {
    await tasksClient.deleteTask({ name: taskName });
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code !== 5) {
      logger.warn("[notifications] Failed to delete task", error);
    }
  }
};

export const onExerciseTimerWrite = onDocumentWritten(
  "users/{uid}/exercises/{exerciseId}",
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;

    const beforeTimer = before?.timerEndsAt ?? null;
    const afterTimer = after?.timerEndsAt ?? null;
    const beforeTaskName = before?.scheduledNotificationTaskName ?? null;
    const afterTaskName = after?.scheduledNotificationTaskName ?? null;

    if (beforeTimer === afterTimer && beforeTaskName !== afterTaskName) {
      return null;
    }

    if (!after || !event.data?.after?.exists) {
      await cancelTaskIfExists(beforeTaskName);
      return null;
    }

    if (typeof afterTimer !== "number") {
      if (beforeTaskName) {
        await cancelTaskIfExists(beforeTaskName);
        await event.data.after.ref.update({
          scheduledNotificationTaskName: admin.firestore.FieldValue.delete(),
        });
      }
      return null;
    }

    if (afterTimer <= Date.now()) {
      if (beforeTaskName) {
        await cancelTaskIfExists(beforeTaskName);
        await event.data.after.ref.update({
          scheduledNotificationTaskName: admin.firestore.FieldValue.delete(),
        });
      }
      return null;
    }

    if (beforeTaskName) {
      await cancelTaskIfExists(beforeTaskName);
    }

    const parent = getTaskParent();
    if (!parent) {
      logger.error("[notifications] Missing project id for Cloud Tasks.");
      return null;
    }

    const taskId = buildTaskId({
      uid: event.params.uid,
      exerciseId: event.params.exerciseId,
      timerEndsAt: afterTimer,
    });
    const taskName = getTaskName(taskId);
    const payload = {
      uid: event.params.uid,
      exerciseId: event.params.exerciseId,
      timerEndsAt: afterTimer,
    };
    const url = `https://${REGION}-${getProjectId()}.cloudfunctions.net/sendRestNotification`;

    const task = {
      name: taskName || undefined,
      httpRequest: {
        httpMethod: "POST" as const,
        url,
        headers: {
          "Content-Type": "application/json",
          ...(TASKS_SECRET ? { "X-Cloud-Tasks-Secret": TASKS_SECRET } : {}),
        },
        body: Buffer.from(JSON.stringify(payload)),
        ...(TASKS_SERVICE_ACCOUNT
          ? { oidcToken: { serviceAccountEmail: TASKS_SERVICE_ACCOUNT } }
          : {}),
      },
      scheduleTime: {
        seconds: Math.floor(afterTimer / 1000),
      },
    };

    const [response] = await tasksClient.createTask({ parent, task });
    await event.data.after.ref.update({
      scheduledNotificationTaskName: response.name,
    });

    return null;
  }
);

export const sendRestNotification = onRequest(async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    if (TASKS_SECRET && req.get("X-Cloud-Tasks-Secret") !== TASKS_SECRET) {
      res.status(403).send("Forbidden");
      return;
    }

    const { uid } = req.body ?? {};
    if (!uid) {
      res.status(400).send("Missing uid");
      return;
    }

    const tokensSnap = await admin.firestore().collection("users").doc(uid).collection("tokens").get();
    if (tokensSnap.empty) {
      res.status(200).json({ sent: 0, failures: 0 });
      return;
    }

    const tokens = tokensSnap.docs.map((doc) => doc.get("token")).filter(Boolean);
    if (tokens.length === 0) {
      res.status(200).json({ sent: 0, failures: 0 });
      return;
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      data: {
        title: "Rest is over",
        body: "Time for the next set.",
      },
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((result, index) => {
      if (result.success) return;
      const code = result.error?.code ?? "";
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        invalidTokens.push(tokens[index]);
      }
    });

    await Promise.all(
      invalidTokens.map((token) =>
        admin.firestore().collection("users").doc(uid).collection("tokens").doc(token).delete()
      )
    );

    res.status(200).json({
      sent: response.successCount,
      failures: response.failureCount,
      invalidTokens: invalidTokens.length,
    });
  }
);
