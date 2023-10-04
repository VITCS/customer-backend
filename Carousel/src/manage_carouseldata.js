const AWS = require("aws-sdk");
const s3 = new AWS.S3();
/**************************************************************
 * Main Handler
 **************************************************************/
exports.handler = async function (event, context, callback) {
  if (!event) throw new Error("Event not found");
  let response;
  console.log("Received event {}", JSON.stringify(event, 3));
  try {
    switch (event.field) {
      case "listCarouselData":
        response = await listCarouselData();
        break;
      case "getCarouselData":
        response = await getCarouselData(event.body);
        break;
    }
  } catch (e) {
    console.error("Error Occured", e);
  }
  return response;
};

/**************************************************************
 * List Carousel Data
 **************************************************************/
const listCarouselData = async () => {
  try {
    const folderParams = {
      Bucket: "spirits-carousel",
      Delimiter: "/",
    };

    const resFolders = await s3.listObjectsV2(folderParams).promise();

    const resultFiles = [];

    await Promise.all(
      resFolders.CommonPrefixes.map(async (item) => {
        const filesParams = {
          Bucket: process.env.BUCKET_NAME,
          Prefix: item.Prefix,
        };

        const filesRes = await s3.listObjectsV2(filesParams).promise();
        filesRes.Contents.shift();

        filesRes.Contents.forEach((item) => resultFiles.push(item.Key));
      })
    );

    const result = [];

    await Promise.all(
      resultFiles.map(async (item) => {
        const urlTagsParams = {
          Bucket: process.env.BUCKET_NAME,
          Key: item,
        };

        const resUrl = await s3.getSignedUrlPromise("getObject", urlTagsParams);
        const resTags = await s3.getObjectTagging(urlTagsParams).promise();

        result.push({
          name: item.split("/")[0],
          imageUrl: resUrl,
          tags: resTags.TagSet,
        });
      })
    );

    return result;
  } catch (err) {
    console.log("ERROR:: ", err);
  }
};

/**************************************************************
 * Get Carousel Data
 **************************************************************/
const getCarouselData = async (body) => {
  try {
    const params = {
      Bucket: process.env.BUCKET_NAME,
      Delimiter: "/",
      Prefix: `${body.promoName}/`,
    };

    const objects = [];

    const res = await s3.listObjectsV2(params).promise();
    res.Contents.shift();

    await Promise.all(
      res.Contents.map(async (item) => {
        const getURLTagsParams = {
          Bucket: process.env.BUCKET_NAME,
          Key: item.Key,
        };

        const urlRes = await s3.getSignedUrlPromise(
          "getObject",
          getURLTagsParams
        );
        const tagsRes = await s3.getObjectTagging(getURLTagsParams).promise();

        objects.push({ imageUrl: urlRes, tags: [...tagsRes.TagSet] });
      })
    );

    return objects;
  } catch (err) {
    console.log("ERROR:: ", err);
  }
};
