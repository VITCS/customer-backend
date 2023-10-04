const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  let response;
  console.log("Received event {}", JSON.stringify(event, 3));
  try {
    const { referralUrl, storeId } = event.input;

    // const referralUrl = "www.merchantspecifcstorewebsite.com";
    // const refCodes = ["newYearPromotion", "Promotion"];
    const paramsGetCustomer = {
      TableName: process.env.STORE_TABLE,
      //IndexName: "byMerchantWebsite",
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": storeId,
      },
    };
    console.log("paramsGetCustomer : ", paramsGetCustomer);
    const getStore = await dynamodb.query(paramsGetCustomer).promise();
    console.log(" getStore :: ", getStore);
    if (getStore.Count > 0) {
      for (let item of getStore.Items) {
        return {
          isValid: item.id === storeId && item.referralUrl === referralUrl,
        };
      }
    }
    // let refferalCode = [];
    // for (let item of getStore.Items) {
    //   refferalCode = item.refCodes;
    // }
    // let refferalCode = getStore.Items.refCodes;
    // console.log("refferalCode : ", refferalCode);
    // if (getStore) {
    //   return {
    //     isValid:
    //       refferalCode.length == refCodes.length &&
    //       refferalCode.some((e1) =>
    //         refCodes.some((e2) =>
    //           Object.keys(e1).some((key) => e1[key] === e2[key])
    //         )
    //       ),
    //   };
    // }
  } catch (err) {
    console.error("Error Occured", err);
  }
};
