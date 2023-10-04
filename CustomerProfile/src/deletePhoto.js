const AWS = require("aws-sdk");

/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  let response;
  console.log("Received event {}", JSON.stringify(event, 3));
  try {
    return await deletePhoto(event);
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
 * S3 Delete Photo
 **************************************************************/
const deletePhoto = async function (event) {
  try {
    let args = event.body;

    const s3 = new AWS.S3({
      signatureVersion: "v4",
    });

    let Key;
    let bucketName;
    let s3Params;

    Key = `${args.fileName}`;
    bucketName = process.env.CUSTOMER_BUCKET_NAME;

    s3Params = {
      Bucket: bucketName,
      Key,
    };

    let response = await setAsyncTimeout(
      s3.deleteObject(s3Params).promise(),
      5000
    );

    return (response = {
      status: 200,
      fileName: args.fileName,
    });
  } catch (err) {
    console.error("Error Occured", err);
  }
};
