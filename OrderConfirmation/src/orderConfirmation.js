const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();
const msal = require("@azure/msal-node");
const Axios = require("axios");
const ejs = require("ejs");
const pdf = require("html-pdf");

const TEMPLATE_BUCKET = process.env.TEMPLATE_BUCKET;
const TEMPLATE_KEY = process.env.TEMPLATE_KEY;
const CUSTOMER_TABLE = process.env.CUSTOMER_TABLE;
/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  try {
    console.log("Event received", JSON.stringify(event));
    const { userId, id } = event.detail.input;

    let customerParms = {
      TableName: CUSTOMER_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    };
    const customerDetails = await dynamodb.query(customerParms).promise();
    if (customerDetails) {
      let emailId = customerDetails.email;

      let htmlStrArr = [];

      for (const item of event.detail.input.orderShipment) {
        item.customerProfile = customerDetails;
        let htmlStrObj = await buildOrderConfirmation(item);
        htmlStrArr.push(htmlStrObj);
      }

      // await sendOrderConfirmation(
      //   "Thank you for Your Order",
      //   htmlStrArr,
      //   "sridhar@1800spirits.com"
      // );
      await sendOrderConfirmation(
        "Thank you for Your Order",
        htmlStrArr,
        emailId
      );
      //    await sendOrderConfirmation("Thank you for Your Order", htmlStr, null, "sridhar@1800spirits.com");
    }
  } catch (e) {
    console.error("Error", e);
  }
};

/**************************************************************
 * Define Order Confirmation function
 **************************************************************/
const buildOrderConfirmation = async (order) => {
  let templateStr = await getTemplate(TEMPLATE_BUCKET, TEMPLATE_KEY);
  let htmlStr = ejs.render(templateStr, { order: order });

  const res = await new Promise((resolve, reject) => {
    pdf.create(htmlStr).toBuffer((err, buffer) => {
      if (err) reject(err);
      else resolve(buffer);
    });
  });

  await uploadPdf(
    res,
    "843219620739-spirits-shipmentconfirmation",
    `shipment-confirmations/sit/${order.userId}/${order.id}-${order.userId}.pdf`
  );

  return { htmlStr, pdfFile: res };
};

/**************************************************************
 * Define Order Confirmation function
 **************************************************************/
const sendOrderConfirmation = async (
  subjectStr,
  htmlStrArr,
  toEmailAddress
) => {
  const tokenRequest = {
    scopes: ["https://graph.microsoft.com/.default"], // e.g. ''
  };
  //**************************************************************
  //* Hardcoding the Values.  To be changed
  //**************************************************************
  const USER_ID = "61f34de5-9902-4d83-a699-15353a961203";
  const msalConfig = {
    auth: {
      clientId: "9ca30616-5b5b-4c4c-a181-4adacbc9edfb",
      clientSecret: "5tP7Q~aLPuXwMG~LvO~swp8n.WhnDLHKzyCTn",
      authority: `https://login.microsoftonline.com/22ecf06e-e89f-4a39-9e8b-9f3baef9b1cb`,
    },
  };
  const cca = new msal.ConfidentialClientApplication(msalConfig);

  const authResponse = await cca.acquireTokenByClientCredential(tokenRequest);

  console.log("Got an auth token! ", authResponse.accessToken);

  //Given the token,you can now set it to the header of any Axios calls made to Microsoft Graph API
  const authHeader = (token) => {
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  for (const item of htmlStrArr) {
    const emailBody = {
      message: {
        subject: subjectStr,
        //      importance: "Low",
        body: {
          contentType: "HTML",
          content: item.htmlStr,
        },
        toRecipients: [
          {
            emailAddress: {
              address: toEmailAddress,
              // address: "archish@1800spirits.com",
            },
          },
        ],
        attachments: [
          {
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: "shipment-confirmation.pdf",
            contentType: "application/pdf",
            // contentBytes: 'SGVsbG8gV29ybGQh'
            contentBytes: item.pdfFile.toString("base64"),
          },
        ],
      },
    };
    const sendEmailURL =
      "https://graph.microsoft.com/v1.0/users/" + USER_ID + "/sendMail";
    const response = await Axios.post(
      sendEmailURL,
      emailBody,
      authHeader(authResponse.accessToken)
    );

    const emailId = response.data.id;
    console.log("Successfully sent the Email" + emailId);
  }

  //In order to send an email, we needed to draft the email first and get an emailId
  // const sendEmailURL = "https://graph.microsoft.com/v1.0/users/"+USER_ID+"/messages/sridhar@1800spirits.com/send";
  // const snedResponse= await Axios.post(sendEmailURL, {}, authHeader(authResponse.accessToken));
};

/**************************************************************
 * getTemplate
 **************************************************************/
const getTemplate = async (bucket, objectKey) => {
  try {
    const params = {
      Bucket: bucket,
      Key: objectKey,
    };
    const s3 = new AWS.S3();
    const data = await s3.getObject(params).promise();
    return data.Body.toString("utf-8");
  } catch (e) {
    throw new Error(`Could not retrieve file from S3: ${e.message}`);
  }
};

/**************************************************************
 * Upload PDF
 **************************************************************/
const uploadPdf = async (pdfBuffer, bucket, objectKey) => {
  try {
    const params = {
      Body: pdfBuffer,
      Bucket: bucket,
      Key: objectKey,
      ContentType: "application/pdf",
    };

    const s3 = new AWS.S3();
    const data = await s3.putObject(params).promise();
    return data;
  } catch (err) {
    console.log(err);
    throw new Error("Could not upload the files:: ", err.message);
  }
};
