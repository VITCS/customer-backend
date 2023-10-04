const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const fetch = require("node-fetch");
const ssm = new AWS.SSM();

exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  try {
    console.log("Event received", JSON.stringify(event));
    const keyParams = {
      Name: "/spirits/fcm/fcm_key",
      WithDecryption: true,
    };

    const keyParameter = await ssm.getParameter(keyParams).promise();
    const fcmKey = keyParameter.Parameter.Value;

    const { shipmentStatus, orderId, assignedStoreId, userId } =
      event.detail.input;
    async function getCustomerProfile(val) {
      // body...
      var paramsStore = {
        TableName: process.env.CUSTOMER_PROFILE_TABLE,
        // IndexName: 'byStore',
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": val,
        },
      };
      const getCustomerDeviceToken = await dynamodb
        .query(paramsStore)
        .promise();

      if (JSON.stringify(getCustomerDeviceToken) === "{}") return false;
      else return getCustomerDeviceToken;
    }

    async function getUserWithStoreId(val) {
      // body...
      var paramsStore = {
        TableName: process.env.MERCHANT_USER_STORE_TABLE,
        IndexName: "byStore",
        KeyConditionExpression: "storeId = :storeId",
        ExpressionAttributeValues: {
          ":storeId": val,
        },
      };
      const getUserDeviceToken = await dynamodb.query(paramsStore).promise();

      if (JSON.stringify(getUserDeviceToken) === "{}") return false;
      else return getUserDeviceToken;
    }
    let users;
    let deviceTokenArry = [];
    // customer to mercahnt notificaation
    if (shipmentStatus === "Placed" || "Created" || "Cancelled") {
      if (assignedStoreId) {
        users = await getUserWithStoreId(assignedStoreId);
        console.log("users::: ", users);
        for (const item in users.Items) {
          const paramsStoreUser = {
            TableName: process.env.DEVICE_TOKEN,
            IndexName: "byUserId",
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
              ":userId": users.Items[item].userId,
            },
          };

          const res = await dynamodb.query(paramsStoreUser).promise();

          console.log("result:: ", res);
          if (res.Items.length > 0)
            deviceTokenArry.push(res.Items[0].deviceToken);
        }
      }
    } // merchant to customer notification
    else if (shipmentStatus === "Accepted" || "Rejected" || "Picked") {
      users = await getCustomerProfile(userId);
      console.log("users getCustomerDeviceToken ::: ", users);
      for (const item in users.Items) {
        const paramsStoreUser = {
          TableName: process.env.DEVICE_TOKEN,
          IndexName: "byUserId",
          KeyConditionExpression: "userId = :userId",
          ExpressionAttributeValues: {
            ":userId": users.Items[item].userId,
          },
        };

        const res = await dynamodb.query(paramsStoreUser).promise();

        console.log("result:: ", res);
        if (res.Items.length > 0)
          deviceTokenArry.push(res.Items[0].deviceToken);
      }
    }
    if (deviceTokenArry.length > 0) {
      const fcmApiUrl = `https://fcm.googleapis.com/fcm/send`;

      const bodyContent = {
        // to: deviceTokenArry.toString(),
        registration_ids: deviceTokenArry,
        notification: {
          body: shipmentStatus,
          title: "Order Status",
        },
      };
      await fetch(fcmApiUrl, {
        method: "POST",
        body: JSON.stringify(bodyContent),
        cache: "no-cache",
        headers: {
          Host: "fcm.googleapis.com",
          "Content-Type": "application/json",
          Authorization: `key=${fcmKey}`,
        },
      })
        .then((res) => {
          console.log("fcm reponse", res);
        })
        .catch((err) => {
          console.log("fcm error", err);
        });
    }
  } catch (e) {
    console.error("Error", e);
  }
};
