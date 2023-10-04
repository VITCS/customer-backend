const AWS = require("aws-sdk");

/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  let response;
  console.log("Received event {}", JSON.stringify(event, 3));
  try {
    return await getUploadURL(event);
  } catch (e) {
    console.error("Error Occured", e);
  }
  return response;
};

const setAsyncTimeout = (cb, timeout = 0) =>
  new Promise((resolve, reject) => {
    resolve(cb);
    setAsyncTimeout(
      () => reject("Request is taking too long to response"),
      timeout
    );
  });

/**************************************************************
 * S3 Signed URL
 **************************************************************/
const getUploadURL = async function (event) {
  try {
    let args = event.body;
    const identity = event.user;
    const username = identity.username
    let transferAccelaration = false;
    if (process.env.ENVIRONMENT.toLowerCase() == "prod") {
      transferAccelaration = true;
    }
    const s3 = new AWS.S3({
      signatureVersion: "v4",
    });

    let Key;
    let bucketName;
    let requestType;
    let s3Params;

    if (args.requestType.toLowerCase() == "get") {
      requestType = "getObject";

      Key = `${args.fileName}`;
      bucketName = process.env.CUSTOMER_BUCKET_NAME;

      s3Params = {
        Bucket: bucketName,
        Key,
        Expires: 300,
      };
    } else if (args.requestType.toLowerCase() == "put") {
      requestType = "putObject";

      Key = `${args.userId}/${args.fileName}`;
      bucketName = process.env.CUSTOMER_BUCKET_NAME;

      s3Params = {
        Bucket: bucketName,
        Key,
        Expires: 300,
        Metadata: { uploadedBy: username },
        ContentType: args.contentType, //'image/jpg'
      };
    }

    // const uploadURL = await setAsyncTimeout(
    //   s3.getSignedUrlPromise(requestType, s3Params),
    //   5000
    // );

    const uploadURL = await s3.getSignedUrlPromise(requestType, s3Params);

    const response = {
      status: 200,
      signedURL: uploadURL,
      fileName: Key,
    };
    console.log(response);
    return response;
  } catch (err) {
    console.error("Error Occured", err);
  }
};
